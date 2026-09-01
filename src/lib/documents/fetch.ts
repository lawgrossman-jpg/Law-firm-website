import "server-only";
import * as graph from "@/lib/msgraph/client";
import * as drive from "@/lib/googledrive/client";
import { resolveLibraryFromDrivePath } from "@/lib/msgraph/libraries";
import type { documents } from "@/db/schema";

type DocumentRow = typeof documents.$inferSelect;

/** Downloads a document's bytes from whichever provider currently holds
 * it, falling back to the other provider if the primary is unreachable —
 * so the in-app viewer/download never has to send the user out to
 * SharePoint or Drive directly. */
export async function fetchDocumentBytes(doc: DocumentRow): Promise<ArrayBuffer> {
  const tryGraph = async () => {
    if (!doc.sharepointItemId) throw new Error("no sharepoint item id");
    const resolved = await resolveLibraryFromDrivePath(doc.relativePath);
    if (!resolved) throw new Error(`document path "${doc.relativePath}" is not under a known library`);
    return graph.downloadFileContent(resolved.library.driveId, doc.sharepointItemId);
  };
  const tryDrive = async () => {
    if (!doc.driveFileId) throw new Error("no drive file id");
    return drive.downloadFile(doc.driveFileId);
  };

  const [first, second] = doc.primaryProvider === "drive" ? [tryDrive, tryGraph] : [tryGraph, tryDrive];

  try {
    return await first();
  } catch (firstErr) {
    try {
      return await second();
    } catch {
      throw firstErr;
    }
  }
}
