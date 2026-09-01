import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { newId } from "@/lib/id";
import * as graph from "@/lib/msgraph/client";
import * as drive from "@/lib/googledrive/client";
import { getPrimaryCaseLibrary } from "@/lib/msgraph/libraries";

/** Creates the case's root folder plus its case-type folder template both
 * in SharePoint (in the primary case library — normally "תיקים פתוחים",
 * the source of truth) and, mirrored immediately, in Google Drive under
 * that library's folder — so the tree exists on both sides right away
 * instead of waiting for the first webhook-driven sync pass. Records each
 * folder in sync_mappings for the ongoing sync engine to track.
 *
 * `caseRow.folderPath` is relative to the shared Drive root (i.e. already
 * prefixed with the library name); the path passed to Graph calls has
 * that prefix stripped, since SharePoint paths are relative to the
 * library's own root. */
export async function provisionCaseFolders(caseId: string): Promise<void> {
  const db = await getDb();
  const [caseRow] = await db
    .select()
    .from(schema.cases)
    .where(eq(schema.cases.id, caseId))
    .limit(1);
  if (!caseRow) throw new Error("case not found");

  const library = await getPrimaryCaseLibrary();
  if (!caseRow.folderPath.startsWith(`${library.name}/`)) {
    throw new Error(
      `case folderPath "${caseRow.folderPath}" is not under the primary case library "${library.name}"`,
    );
  }
  const spRootRelPath = caseRow.folderPath.slice(library.name.length + 1);

  let subFolders: string[] = [];
  if (caseRow.caseTypeId) {
    const [caseType] = await db
      .select()
      .from(schema.caseTypes)
      .where(eq(schema.caseTypes.id, caseRow.caseTypeId))
      .limit(1);
    subFolders = caseType?.folderTemplate ?? [];
  }

  const spPaths = [spRootRelPath, ...subFolders.map((s) => `${spRootRelPath}/${s}`)];
  const now = new Date().toISOString();

  const mappings: Array<{ driveRelativePath: string; spItemId: string; driveFileId: string }> = [];
  for (const spPath of spPaths) {
    const driveRelativePath = `${library.name}/${spPath}`;
    const spItemId = await graph.ensureFolder(library.driveId, spPath);
    const driveFileId = await drive.ensureFolderPath(driveRelativePath);
    mappings.push({ driveRelativePath, spItemId, driveFileId });
  }

  const [root] = mappings;
  await db
    .update(schema.cases)
    .set({
      sharepointLibraryId: library.id,
      sharepointFolderItemId: root.spItemId,
      driveFolderId: root.driveFileId,
    })
    .where(eq(schema.cases.id, caseId));

  for (const m of mappings) {
    const [existing] = await db
      .select({ id: schema.syncMappings.id })
      .from(schema.syncMappings)
      .where(eq(schema.syncMappings.relativePath, m.driveRelativePath))
      .limit(1);

    if (existing) {
      await db
        .update(schema.syncMappings)
        .set({
          sharepointDriveId: library.driveId,
          sharepointItemId: m.spItemId,
          driveFileId: m.driveFileId,
          lastSyncedAt: now,
          lastSyncDirection: "initial_migration",
        })
        .where(eq(schema.syncMappings.id, existing.id));
    } else {
      await db.insert(schema.syncMappings).values({
        id: newId("sm"),
        itemType: "folder",
        relativePath: m.driveRelativePath,
        sharepointDriveId: library.driveId,
        sharepointItemId: m.spItemId,
        driveFileId: m.driveFileId,
        lastSyncedAt: now,
        lastSyncDirection: "initial_migration",
      });
    }
  }
}
