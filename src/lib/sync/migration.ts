import "server-only";
import { eq, isNull } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { newId } from "@/lib/id";
import * as graph from "@/lib/msgraph/client";
import * as drive from "@/lib/googledrive/client";
import { sha256Hex } from "@/lib/sync/hashing";
import { logAction } from "@/lib/audit";

type MigrationResult = { foldersCopied: number; filesCopied: number; errors: string[] };

/** One-time full migration: walks the entire SharePoint document library
 * tree and mirrors every folder/file into Google Drive under the shared
 * root, preserving the exact folder structure and recording each item in
 * sync_mappings. Idempotent — safe to re-run (e.g. after a partial
 * failure); existing folders/files are matched by path and updated rather
 * than duplicated. Intended to run once via /api/sync/migrate, in the
 * background (ctx.waitUntil), before webhook-driven real-time sync takes
 * over for anything created afterwards. */
export async function runInitialMigration(triggeredByEmployeeId: string): Promise<MigrationResult> {
  const result: MigrationResult = { foldersCopied: 0, filesCopied: 0, errors: [] };
  const driveRootId = await drive.getRootFolderId();

  await walk("", driveRootId, result);

  await logAction({
    action: "sync.migration_run",
    entityType: "sync",
    employeeId: triggeredByEmployeeId,
    details: { ...result, errors: result.errors.slice(0, 20) },
  });

  return result;
}

async function walk(relativePath: string, driveParentId: string, result: MigrationResult): Promise<void> {
  const children = await graph.listChildren(relativePath);

  for (const item of children) {
    const itemRelPath = relativePath ? `${relativePath}/${item.name}` : item.name;
    try {
      if (item.folder) {
        const driveFolderId = await drive.ensureFolder(driveParentId, item.name);
        await upsertMapping({
          itemType: "folder",
          relativePath: itemRelPath,
          sharepointItemId: item.id,
          driveFileId: driveFolderId,
        });
        result.foldersCopied += 1;
        await maybeLinkCaseFolder(itemRelPath);
        await walk(itemRelPath, driveFolderId, result);
      } else {
        const content = await graph.downloadFileContent(item.id);
        const hash = await sha256Hex(content);
        const driveFile = await drive.uploadFile({
          name: item.name,
          parentId: driveParentId,
          content,
          mimeType: item.file?.mimeType ?? "application/octet-stream",
        });
        await upsertMapping({
          itemType: "file",
          relativePath: itemRelPath,
          sharepointItemId: item.id,
          sharepointETag: item.eTag,
          sharepointHash: hash,
          driveFileId: driveFile.id,
          driveMd5: driveFile.md5Checksum,
        });
        result.filesCopied += 1;
        await maybeLinkCaseDocument(itemRelPath, item, hash, driveFile.id, driveFile.md5Checksum);
      }
    } catch (err) {
      result.errors.push(`${itemRelPath}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

async function upsertMapping(params: {
  itemType: "file" | "folder";
  relativePath: string;
  sharepointItemId: string;
  sharepointETag?: string;
  sharepointHash?: string;
  driveFileId: string;
  driveMd5?: string;
}): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  const [existing] = await db
    .select({ id: schema.syncMappings.id })
    .from(schema.syncMappings)
    .where(eq(schema.syncMappings.relativePath, params.relativePath))
    .limit(1);

  const values = {
    sharepointItemId: params.sharepointItemId,
    sharepointETag: params.sharepointETag ?? null,
    sharepointHash: params.sharepointHash ?? null,
    driveFileId: params.driveFileId,
    driveMd5: params.driveMd5 ?? null,
    lastSyncedAt: now,
    lastSyncDirection: "initial_migration" as const,
  };

  if (existing) {
    await db.update(schema.syncMappings).set(values).where(eq(schema.syncMappings.id, existing.id));
  } else {
    await db.insert(schema.syncMappings).values({
      id: newId("sm"),
      itemType: params.itemType,
      relativePath: params.relativePath,
      ...values,
    });
  }
}

/** If a migrated folder is a case's own root folder (matched by
 * cases.folder_path), backfill its SharePoint/Drive folder ids so cases
 * created before migration also get web-viewer/download support. */
async function maybeLinkCaseFolder(relativePath: string): Promise<void> {
  if (!relativePath.startsWith("Cases/")) return;
  const db = await getDb();
  const [caseRow] = await db
    .select()
    .from(schema.cases)
    .where(eq(schema.cases.folderPath, relativePath))
    .limit(1);
  if (!caseRow) return;

  const mapping = await db
    .select()
    .from(schema.syncMappings)
    .where(eq(schema.syncMappings.relativePath, relativePath))
    .limit(1);
  const m = mapping[0];
  if (!m) return;

  await db
    .update(schema.cases)
    .set({ sharepointFolderItemId: m.sharepointItemId, driveFolderId: m.driveFileId })
    .where(eq(schema.cases.id, caseRow.id));
}

/** If a migrated file lives under a known case's folder, registers it as
 * a `documents` row (source "migrated") so it shows up in that case's
 * document list and web viewer, not just in the raw sync mapping table. */
async function maybeLinkCaseDocument(
  relativePath: string,
  item: Awaited<ReturnType<typeof graph.listChildren>>[number],
  hash: string,
  driveFileId: string,
  driveMd5?: string,
): Promise<void> {
  if (!relativePath.startsWith("Cases/")) return;
  const db = await getDb();

  const segments = relativePath.split("/");
  if (segments.length < 2) return;
  const caseFolderPath = segments.slice(0, 2).join("/"); // "Cases/<case-folder>"

  const [caseRow] = await db
    .select()
    .from(schema.cases)
    .where(eq(schema.cases.folderPath, caseFolderPath))
    .limit(1);
  if (!caseRow) return;

  const [existingDoc] = await db
    .select({ id: schema.documents.id })
    .from(schema.documents)
    .where(eq(schema.documents.sharepointItemId, item.id))
    .limit(1);
  if (existingDoc) return;

  await db.insert(schema.documents).values({
    id: newId("doc"),
    caseId: caseRow.id,
    name: item.name,
    relativePath,
    primaryProvider: "sharepoint",
    sharepointItemId: item.id,
    sharepointETag: item.eTag ?? null,
    driveFileId,
    driveMd5: driveMd5 ?? null,
    contentHash: hash,
    mimeType: item.file?.mimeType ?? null,
    sizeBytes: item.size ?? null,
    source: "migrated",
    version: 1,
    lastModifiedAt: item.lastModifiedDateTime ?? new Date().toISOString(),
  });
}

/** Used by /admin/sync to show whether any cases still lack a linked
 * SharePoint/Drive folder id (e.g. created before the first migration
 * pass, and folder provisioning failed at creation time). */
export async function countUnmappedCaseFolders(): Promise<number> {
  const db = await getDb();
  const rows = await db
    .select({ id: schema.cases.id })
    .from(schema.cases)
    .where(isNull(schema.cases.sharepointFolderItemId));
  return rows.length;
}
