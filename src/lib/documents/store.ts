import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { DocumentSource } from "@/db/schema";
import { newId } from "@/lib/id";
import { sha256Hex } from "@/lib/sync/hashing";
import * as graph from "@/lib/msgraph/client";
import * as drive from "@/lib/googledrive/client";
import { logAction } from "@/lib/audit";

/** Uploads a new document to SharePoint (source of truth), mirrors it
 * immediately to Google Drive, and records it in the documents table plus
 * a sync_mappings row. Used by both the document generator and manual
 * upload / scan ingestion.
 *
 * The case must already have a SharePoint library assigned (set by
 * provisionCaseFolders when the case was created) — that's what tells us
 * which of the firm's ~12 document libraries to write into. */
export async function storeCaseFile(params: {
  caseId: string;
  /** Path relative to the shared Google Drive root, i.e. prefixed with the
   * owning library's name, e.g. "תיקים פתוחים/2026-014-Cohen/מסמכים שנוצרו/ייפוי כוח.docx". */
  relativePath: string;
  fileName: string;
  content: Uint8Array;
  mimeType: string;
  source: DocumentSource;
  employeeId: string;
}): Promise<string> {
  const db = await getDb();

  const [caseRow] = await db
    .select({ sharepointLibraryId: schema.cases.sharepointLibraryId })
    .from(schema.cases)
    .where(eq(schema.cases.id, params.caseId))
    .limit(1);
  if (!caseRow?.sharepointLibraryId) {
    throw new Error("case has no SharePoint library assigned — folder provisioning may have failed");
  }
  const [library] = await db
    .select()
    .from(schema.sharepointLibraries)
    .where(eq(schema.sharepointLibraries.id, caseRow.sharepointLibraryId))
    .limit(1);
  if (!library) throw new Error("case's SharePoint library no longer exists");

  if (!params.relativePath.startsWith(`${library.name}/`)) {
    throw new Error(`relativePath "${params.relativePath}" is not under library "${library.name}"`);
  }
  const spRelativePath = params.relativePath.slice(library.name.length + 1);

  const contentHash = await sha256Hex(params.content);

  const spItem = await graph.uploadFileContent(
    library.driveId,
    spRelativePath,
    params.content,
    params.mimeType,
  );

  const parentPath = params.relativePath.split("/").slice(0, -1).join("/");
  const parentDriveId = await drive.ensureFolderPath(parentPath);
  const driveFile = await drive.uploadFile({
    name: params.fileName,
    parentId: parentDriveId,
    content: params.content,
    mimeType: params.mimeType,
  });

  const documentId = newId("doc");
  const now = new Date().toISOString();

  await db.insert(schema.documents).values({
    id: documentId,
    caseId: params.caseId,
    name: params.fileName,
    relativePath: params.relativePath,
    primaryProvider: "sharepoint",
    sharepointItemId: spItem.id,
    sharepointETag: spItem.eTag ?? null,
    driveFileId: driveFile.id,
    driveMd5: driveFile.md5Checksum ?? null,
    contentHash,
    mimeType: params.mimeType,
    sizeBytes: params.content.byteLength,
    source: params.source,
    version: 1,
    createdByEmployeeId: params.employeeId,
    lastModifiedByEmployeeId: params.employeeId,
    lastModifiedAt: now,
  });

  const [existingMapping] = await db
    .select({ id: schema.syncMappings.id })
    .from(schema.syncMappings)
    .where(eq(schema.syncMappings.relativePath, params.relativePath))
    .limit(1);

  if (existingMapping) {
    await db
      .update(schema.syncMappings)
      .set({
        sharepointDriveId: library.driveId,
        sharepointItemId: spItem.id,
        sharepointETag: spItem.eTag ?? null,
        sharepointHash: contentHash,
        driveFileId: driveFile.id,
        driveMd5: driveFile.md5Checksum ?? null,
        lastSyncedAt: now,
        lastSyncDirection: "sp_to_drive",
      })
      .where(eq(schema.syncMappings.id, existingMapping.id));
  } else {
    await db.insert(schema.syncMappings).values({
      id: newId("sm"),
      itemType: "file",
      relativePath: params.relativePath,
      sharepointDriveId: library.driveId,
      sharepointItemId: spItem.id,
      sharepointETag: spItem.eTag ?? null,
      sharepointHash: contentHash,
      driveFileId: driveFile.id,
      driveMd5: driveFile.md5Checksum ?? null,
      lastSyncedAt: now,
      lastSyncDirection: "sp_to_drive",
    });
  }

  await logAction({
    action: params.source === "generated" ? "document.generate" : "document.upload",
    entityType: "document",
    entityId: documentId,
    employeeId: params.employeeId,
    details: { fileName: params.fileName, caseId: params.caseId },
  });

  return documentId;
}
