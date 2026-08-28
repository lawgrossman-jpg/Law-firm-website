import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { newId } from "@/lib/id";
import * as graph from "@/lib/msgraph/client";
import * as drive from "@/lib/googledrive/client";

/** Creates the case's root folder plus its case-type folder template both
 * in SharePoint (source of truth) and, mirrored immediately, in Google
 * Drive — so the tree exists on both sides right away instead of waiting
 * for the first webhook-driven sync pass. Records each folder in
 * sync_mappings for the ongoing sync engine to track. */
export async function provisionCaseFolders(caseId: string): Promise<void> {
  const db = await getDb();
  const [caseRow] = await db
    .select()
    .from(schema.cases)
    .where(eq(schema.cases.id, caseId))
    .limit(1);
  if (!caseRow) throw new Error("case not found");

  let subFolders: string[] = [];
  if (caseRow.caseTypeId) {
    const [caseType] = await db
      .select()
      .from(schema.caseTypes)
      .where(eq(schema.caseTypes.id, caseRow.caseTypeId))
      .limit(1);
    subFolders = caseType?.folderTemplate ?? [];
  }

  const allPaths = [caseRow.folderPath, ...subFolders.map((s) => `${caseRow.folderPath}/${s}`)];
  const now = new Date().toISOString();

  const mappings: Array<{ relativePath: string; spItemId: string; driveId: string }> = [];
  for (const relativePath of allPaths) {
    const spItemId = await graph.ensureFolder(relativePath);
    const driveId = await drive.ensureFolderPath(relativePath);
    mappings.push({ relativePath, spItemId, driveId });
  }

  const [root] = mappings;
  await db
    .update(schema.cases)
    .set({ sharepointFolderItemId: root.spItemId, driveFolderId: root.driveId })
    .where(eq(schema.cases.id, caseId));

  for (const m of mappings) {
    const [existing] = await db
      .select({ id: schema.syncMappings.id })
      .from(schema.syncMappings)
      .where(eq(schema.syncMappings.relativePath, m.relativePath))
      .limit(1);

    if (existing) {
      await db
        .update(schema.syncMappings)
        .set({
          sharepointItemId: m.spItemId,
          driveFileId: m.driveId,
          lastSyncedAt: now,
          lastSyncDirection: "initial_migration",
        })
        .where(eq(schema.syncMappings.id, existing.id));
    } else {
      await db.insert(schema.syncMappings).values({
        id: newId("sm"),
        itemType: "folder",
        relativePath: m.relativePath,
        sharepointItemId: m.spItemId,
        driveFileId: m.driveId,
        lastSyncedAt: now,
        lastSyncDirection: "initial_migration",
      });
    }
  }
}
