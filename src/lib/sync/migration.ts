import "server-only";
import { eq, isNull } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { newId } from "@/lib/id";
import * as graph from "@/lib/msgraph/client";
import * as drive from "@/lib/googledrive/client";
import { sha256Hex } from "@/lib/sync/hashing";
import { logAction } from "@/lib/audit";
import { listEnabledLibraries, type SharepointLibrary } from "@/lib/msgraph/libraries";

type MigrationResult = { foldersCopied: number; filesCopied: number; errors: string[] };

/** One-time full migration: walks every enabled SharePoint document
 * library's tree (the firm's site has ~12 — תיקים פתוחים, תיקים סגורים,
 * פסיקה, ...) and mirrors each into its own top-level folder (named after
 * the library) under the shared Google Drive root, preserving the exact
 * folder structure and recording each item in sync_mappings. Idempotent —
 * safe to re-run (e.g. after a partial failure); existing folders/files
 * are matched by path and updated rather than duplicated. Intended to run
 * once via /api/sync/migrate, in the background (ctx.waitUntil), before
 * webhook-driven real-time sync takes over for anything created
 * afterwards. */
export async function runInitialMigration(triggeredByEmployeeId: string): Promise<MigrationResult> {
  const result: MigrationResult = { foldersCopied: 0, filesCopied: 0, errors: [] };
  const driveRootId = await drive.getRootFolderId();
  const libraries = await listEnabledLibraries();

  for (const library of libraries) {
    try {
      const libraryDriveFolderId = await drive.ensureFolder(driveRootId, library.name);
      await walk(library, "", library.name, libraryDriveFolderId, result);
    } catch (err) {
      result.errors.push(`[${library.name}]: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  await logAction({
    action: "sync.migration_run",
    entityType: "sync",
    employeeId: triggeredByEmployeeId,
    details: { ...result, errors: result.errors.slice(0, 20), libraries: libraries.map((l) => l.name) },
  });

  return result;
}

/** @param spRelativePath path relative to the library's own SharePoint root.
 * @param driveRelativePath the same node's path relative to the shared
 * Drive root (i.e. `spRelativePath` prefixed with the library name). */
async function walk(
  library: SharepointLibrary,
  spRelativePath: string,
  driveRelativePath: string,
  driveParentId: string,
  result: MigrationResult,
): Promise<void> {
  const children = await graph.listChildren(library.driveId, spRelativePath);

  for (const item of children) {
    const itemSpPath = spRelativePath ? `${spRelativePath}/${item.name}` : item.name;
    const itemDrivePath = `${driveRelativePath}/${item.name}`;
    try {
      if (item.folder) {
        const driveFolderId = await drive.ensureFolder(driveParentId, item.name);
        await upsertMapping({
          itemType: "folder",
          relativePath: itemDrivePath,
          sharepointDriveId: library.driveId,
          sharepointItemId: item.id,
          driveFileId: driveFolderId,
        });
        result.foldersCopied += 1;
        await maybeLinkCaseFolder(itemDrivePath, library);
        await walk(library, itemSpPath, itemDrivePath, driveFolderId, result);
      } else {
        const content = await graph.downloadFileContent(library.driveId, item.id);
        const hash = await sha256Hex(content);
        const driveFile = await drive.uploadFile({
          name: item.name,
          parentId: driveParentId,
          content,
          mimeType: item.file?.mimeType ?? "application/octet-stream",
        });
        await upsertMapping({
          itemType: "file",
          relativePath: itemDrivePath,
          sharepointDriveId: library.driveId,
          sharepointItemId: item.id,
          sharepointETag: item.eTag,
          sharepointHash: hash,
          driveFileId: driveFile.id,
          driveMd5: driveFile.md5Checksum,
        });
        result.filesCopied += 1;
        await maybeLinkCaseDocument(itemDrivePath, item, hash, driveFile.id, driveFile.md5Checksum);
      }
    } catch (err) {
      result.errors.push(`${itemDrivePath}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

async function upsertMapping(params: {
  itemType: "file" | "folder";
  relativePath: string;
  sharepointDriveId: string;
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
    sharepointDriveId: params.sharepointDriveId,
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
async function maybeLinkCaseFolder(driveRelativePath: string, library: SharepointLibrary): Promise<void> {
  const db = await getDb();
  const [caseRow] = await db
    .select()
    .from(schema.cases)
    .where(eq(schema.cases.folderPath, driveRelativePath))
    .limit(1);
  if (!caseRow) return;

  const mapping = await db
    .select()
    .from(schema.syncMappings)
    .where(eq(schema.syncMappings.relativePath, driveRelativePath))
    .limit(1);
  const m = mapping[0];
  if (!m) return;

  await db
    .update(schema.cases)
    .set({
      sharepointLibraryId: library.id,
      sharepointFolderItemId: m.sharepointItemId,
      driveFolderId: m.driveFileId,
    })
    .where(eq(schema.cases.id, caseRow.id));
}

/** If a migrated file lives directly under a known case's folder,
 * registers it as a `documents` row (source "migrated") so it shows up in
 * that case's document list and web viewer, not just in the raw sync
 * mapping table. */
async function maybeLinkCaseDocument(
  driveRelativePath: string,
  item: Awaited<ReturnType<typeof graph.listChildren>>[number],
  hash: string,
  driveFileId: string,
  driveMd5?: string,
): Promise<void> {
  const db = await getDb();

  const segments = driveRelativePath.split("/");
  if (segments.length < 2) return;
  const caseFolderPath = segments.slice(0, 2).join("/"); // "<library>/<case-folder>"

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
    relativePath: driveRelativePath,
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
