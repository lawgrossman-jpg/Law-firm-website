import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { newId } from "@/lib/id";
import * as graph from "@/lib/msgraph/client";
import * as drive from "@/lib/googledrive/client";
import { sha256Hex } from "@/lib/sync/hashing";
import { resolveActorFromGraph, resolveActorFromDrive } from "@/lib/sync/identity";
import { logAction } from "@/lib/audit";
import {
  listEnabledLibraries,
  resolveLibraryFromDrivePath,
  type SharepointLibrary,
} from "@/lib/msgraph/libraries";

// ---------------------------------------------------------------------------
// Cursors (Graph delta link, per library / Drive startPageToken persisted
// in D1)
// ---------------------------------------------------------------------------

async function getCursor(id: string): Promise<string | undefined> {
  const db = await getDb();
  const [row] = await db.select().from(schema.syncCursors).where(eq(schema.syncCursors.id, id)).limit(1);
  return row?.value;
}

async function setCursor(id: string, value: string): Promise<void> {
  const db = await getDb();
  const [existing] = await db
    .select({ id: schema.syncCursors.id })
    .from(schema.syncCursors)
    .where(eq(schema.syncCursors.id, id))
    .limit(1);
  if (existing) {
    await db
      .update(schema.syncCursors)
      .set({ value, updatedAt: new Date().toISOString() })
      .where(eq(schema.syncCursors.id, id));
  } else {
    await db.insert(schema.syncCursors).values({ id, value });
  }
}

function graphCursorKey(driveId: string): string {
  return `graph_delta_link:${driveId}`;
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

type MappingRow = typeof schema.syncMappings.$inferSelect;

async function getMappingBySharepointId(id: string): Promise<MappingRow | undefined> {
  const db = await getDb();
  const [row] = await db.select().from(schema.syncMappings).where(eq(schema.syncMappings.sharepointItemId, id)).limit(1);
  return row;
}

async function getMappingByDriveId(id: string): Promise<MappingRow | undefined> {
  const db = await getDb();
  const [row] = await db.select().from(schema.syncMappings).where(eq(schema.syncMappings.driveFileId, id)).limit(1);
  return row;
}

async function upsertMapping(params: {
  itemType: "file" | "folder";
  relativePath: string;
  sharepointDriveId: string;
  sharepointItemId: string;
  sharepointETag?: string | null;
  sharepointHash?: string | null;
  driveFileId: string;
  driveMd5?: string | null;
  direction: "sp_to_drive" | "drive_to_sp";
}): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  const [existing] = await db
    .select({ id: schema.syncMappings.id })
    .from(schema.syncMappings)
    .where(eq(schema.syncMappings.relativePath, params.relativePath))
    .limit(1);

  const values = {
    itemType: params.itemType,
    sharepointDriveId: params.sharepointDriveId,
    sharepointItemId: params.sharepointItemId,
    sharepointETag: params.sharepointETag ?? null,
    sharepointHash: params.sharepointHash ?? null,
    driveFileId: params.driveFileId,
    driveMd5: params.driveMd5 ?? null,
    lastSyncedAt: now,
    lastSyncDirection: params.direction,
  };

  if (existing) {
    await db.update(schema.syncMappings).set(values).where(eq(schema.syncMappings.id, existing.id));
  } else {
    await db.insert(schema.syncMappings).values({ id: newId("sm"), relativePath: params.relativePath, ...values });
  }
}

function conflictFileName(name: string, sourceLabel: string): string {
  const dot = name.lastIndexOf(".");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return dot > 0
    ? `${name.slice(0, dot)} (גרסה מתנגשת מ-${sourceLabel} ${stamp})${name.slice(dot)}`
    : `${name} (גרסה מתנגשת מ-${sourceLabel} ${stamp})`;
}

async function recordConflict(
  mappingId: string,
  description: string,
  sharepointHash?: string | null,
  driveHash?: string | null,
): Promise<void> {
  const db = await getDb();
  await db.insert(schema.syncConflicts).values({
    id: newId("conflict"),
    syncMappingId: mappingId,
    description,
    sharepointHashAtConflict: sharepointHash ?? null,
    driveHashAtConflict: driveHash ?? null,
  });
  await logAction({ action: "sync.conflict", entityType: "sync_mapping", entityId: mappingId, details: { description } });
}

async function resolveDriveParentRelativePath(parentDriveId: string): Promise<string | null> {
  const rootId = await drive.getRootFolderId();
  if (parentDriveId === rootId) return "";
  const mapping = await getMappingByDriveId(parentDriveId);
  return mapping ? mapping.relativePath : null;
}

// ---------------------------------------------------------------------------
// SharePoint (Graph) -> Google Drive
// ---------------------------------------------------------------------------

export async function processGraphChanges(): Promise<{ processed: number; errors: string[] }> {
  const errors: string[] = [];
  let processed = 0;
  const libraries = await listEnabledLibraries();

  for (const library of libraries) {
    try {
      const cursorKey = graphCursorKey(library.driveId);
      const link = await getCursor(cursorKey);

      if (!link) {
        // First run for this library: establish a baseline delta link
        // without back-filling (the initial migration already mirrored
        // the existing tree) — mirrors processDriveChanges()'s handling
        // of a missing drive_page_token. Still has to page through the
        // full initial delta to reach the final deltaLink (Graph gives no
        // way to skip straight to it), but that's metadata-only listing,
        // not per-item download+upload, so it's fast even for a library
        // with thousands of items.
        let page = await graph.deltaQuery(library.driveId);
        while (page.nextLink) {
          page = await graph.deltaQuery(library.driveId, page.nextLink);
        }
        if (page.deltaLink) await setCursor(cursorKey, page.deltaLink);
        continue;
      }

      let page = await graph.deltaQuery(library.driveId, link);
      let items = [...page.value];
      while (page.nextLink) {
        page = await graph.deltaQuery(library.driveId, page.nextLink);
        items = items.concat(page.value);
      }

      for (const item of items) {
        try {
          await applyGraphItem(item, library);
          processed += 1;
        } catch (err) {
          errors.push(`[${library.name}] ${item.name ?? item.id}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      if (page.deltaLink) await setCursor(cursorKey, page.deltaLink);
    } catch (err) {
      errors.push(`[${library.name}]: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { processed, errors };
}

async function applyGraphItem(item: graph.GraphDriveItem, library: SharepointLibrary): Promise<void> {
  const db = await getDb();
  if (!item.parentReference && !item.deleted) return; // drive-root pseudo item

  const existingMapping = await getMappingBySharepointId(item.id);

  if (item.deleted) {
    if (!existingMapping) return;
    if (existingMapping.driveFileId) {
      await drive.trashFile(existingMapping.driveFileId).catch(() => undefined);
    }
    await db.delete(schema.syncMappings).where(eq(schema.syncMappings.id, existingMapping.id));

    const [doc] = await db.select().from(schema.documents).where(eq(schema.documents.sharepointItemId, item.id)).limit(1);
    if (doc) {
      await db.delete(schema.documents).where(eq(schema.documents.id, doc.id));
      await logAction({
        action: "document.delete",
        entityType: "document",
        entityId: doc.id,
        actorLabel: "נמחק ב-SharePoint (סונכרן)",
      });
    }
    return;
  }

  // Paths relative to the library's own SharePoint root...
  const newSpRelPath = graph.itemRelativePath(item);
  const parentSpRelPath = graph.itemParentRelativePath(item);
  // ...and their equivalents relative to the shared Google Drive root
  // (every library lives under its own top-level folder there).
  const newRelPath = `${library.name}/${newSpRelPath}`;
  const parentRelPath = parentSpRelPath ? `${library.name}/${parentSpRelPath}` : library.name;

  const actor = await resolveActorFromGraph(
    item.lastModifiedBy?.user
      ? {
          id: item.lastModifiedBy.user.id,
          displayName: item.lastModifiedBy.user.displayName,
          email: item.lastModifiedBy.user.email,
        }
      : undefined,
  );

  if (item.folder) {
    const driveParentId = await drive.ensureFolderPath(parentRelPath);
    let driveFolderId: string;
    if (existingMapping?.driveFileId) {
      driveFolderId =
        existingMapping.relativePath !== newRelPath
          ? (
              await drive.moveAndRename({
                fileId: existingMapping.driveFileId,
                newParentId: driveParentId,
                newName: item.name,
                actAsEmail: actor.googleEmail,
              })
            ).id
          : existingMapping.driveFileId;
    } else {
      driveFolderId = await drive.ensureFolder(driveParentId, item.name);
    }
    await upsertMapping({
      itemType: "folder",
      relativePath: newRelPath,
      sharepointDriveId: library.driveId,
      sharepointItemId: item.id,
      driveFileId: driveFolderId,
      direction: "sp_to_drive",
    });
    return;
  }

  // --- File ---
  const content = await graph.downloadFileContent(library.driveId, item.id);
  const hash = await sha256Hex(content);

  if (existingMapping?.sharepointHash === hash && existingMapping.relativePath === newRelPath) {
    return; // metadata-only notification, content unchanged
  }

  // Conflict check: has Drive's copy changed independently since our last sync?
  if (existingMapping?.driveFileId && existingMapping.driveMd5) {
    const liveDrive = await drive.getFileMetadata(existingMapping.driveFileId).catch(() => null);
    if (liveDrive?.md5Checksum && liveDrive.md5Checksum !== existingMapping.driveMd5) {
      const parentId = await drive.ensureFolderPath(parentRelPath);
      await drive.uploadFile({
        name: conflictFileName(item.name, "SharePoint"),
        parentId,
        content,
        mimeType: item.file?.mimeType ?? "application/octet-stream",
        actAsEmail: actor.googleEmail,
      });
      await recordConflict(
        existingMapping.id,
        `עודכן גם ב-SharePoint וגם ב-Drive: ${newRelPath}`,
        hash,
        liveDrive.md5Checksum,
      );
      return;
    }
  }

  const driveParentId = await drive.ensureFolderPath(parentRelPath);
  if (existingMapping?.relativePath && existingMapping.relativePath !== newRelPath && existingMapping.driveFileId) {
    await drive.moveAndRename({
      fileId: existingMapping.driveFileId,
      newParentId: driveParentId,
      newName: item.name,
      actAsEmail: actor.googleEmail,
    });
  }
  const driveFile = await drive.uploadFile({
    name: item.name,
    parentId: driveParentId,
    existingFileId: existingMapping?.driveFileId ?? undefined,
    content,
    mimeType: item.file?.mimeType ?? "application/octet-stream",
    actAsEmail: actor.googleEmail,
  });

  await upsertMapping({
    itemType: "file",
    relativePath: newRelPath,
    sharepointDriveId: library.driveId,
    sharepointItemId: item.id,
    sharepointETag: item.eTag,
    sharepointHash: hash,
    driveFileId: driveFile.id,
    driveMd5: driveFile.md5Checksum,
    direction: "sp_to_drive",
  });

  const [doc] = await db.select().from(schema.documents).where(eq(schema.documents.sharepointItemId, item.id)).limit(1);
  if (doc) {
    await db
      .update(schema.documents)
      .set({
        name: item.name,
        relativePath: newRelPath,
        sharepointETag: item.eTag ?? null,
        driveFileId: driveFile.id,
        driveMd5: driveFile.md5Checksum ?? null,
        contentHash: hash,
        version: doc.version + 1,
        lastModifiedByEmployeeId: actor.employeeId,
        lastModifiedAt: new Date().toISOString(),
      })
      .where(eq(schema.documents.id, doc.id));

    await logAction({
      action: "document.sync_update",
      entityType: "document",
      entityId: doc.id,
      employeeId: actor.employeeId,
      actorLabel: actor.employeeId ? undefined : actor.label,
      details: { direction: "sharepoint_to_drive", fileName: item.name },
    });
  }
}

// ---------------------------------------------------------------------------
// Google Drive -> SharePoint
// ---------------------------------------------------------------------------

export async function processDriveChanges(): Promise<{ processed: number; errors: string[] }> {
  const errors: string[] = [];
  let processed = 0;

  let pageToken = await getCursor("drive_page_token");
  if (!pageToken) {
    // First run: establish a baseline cursor without back-filling (the
    // initial migration already mirrored the existing tree).
    const startToken = await drive.getStartPageToken();
    await setCursor("drive_page_token", startToken);
    return { processed: 0, errors: [] };
  }

  let newStartPageToken: string | undefined;
  for (;;) {
    const page = await drive.listChanges(pageToken);
    for (const change of page.changes) {
      try {
        await applyDriveChange(change);
        processed += 1;
      } catch (err) {
        errors.push(`${change.fileId}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    if (page.newStartPageToken) {
      newStartPageToken = page.newStartPageToken;
      break;
    }
    if (!page.nextPageToken) break;
    pageToken = page.nextPageToken;
  }

  if (newStartPageToken) await setCursor("drive_page_token", newStartPageToken);
  return { processed, errors };
}

async function applyDriveChange(change: drive.DriveChange): Promise<void> {
  const db = await getDb();
  const existingMapping = await getMappingByDriveId(change.fileId);

  if (change.removed || change.file?.trashed) {
    if (!existingMapping) return;
    if (existingMapping.sharepointItemId && existingMapping.sharepointDriveId) {
      await graph.deleteItem(existingMapping.sharepointDriveId, existingMapping.sharepointItemId).catch(() => undefined);
    }
    await db.delete(schema.syncMappings).where(eq(schema.syncMappings.id, existingMapping.id));

    const [doc] = await db.select().from(schema.documents).where(eq(schema.documents.driveFileId, change.fileId)).limit(1);
    if (doc) {
      await db.delete(schema.documents).where(eq(schema.documents.id, doc.id));
      await logAction({
        action: "document.delete",
        entityType: "document",
        entityId: doc.id,
        actorLabel: "נמחק ב-Google Drive (סונכרן)",
      });
    }
    return;
  }

  const file = change.file;
  if (!file) return;

  const parentId = file.parents?.[0];
  if (!parentId) return;
  const parentRelPath = await resolveDriveParentRelativePath(parentId);
  if (parentRelPath === null) return; // outside the tracked shared-root tree

  const newRelPath = parentRelPath ? `${parentRelPath}/${file.name}` : file.name;

  // Which SharePoint library does this path belong to? (Its first path
  // segment is a library's top-level folder name — see
  // resolveLibraryFromDrivePath.) Anything else (e.g. a folder created
  // directly under the shared Drive root, outside any library) has
  // nowhere to sync back to in SharePoint, so we skip it.
  const resolved = await resolveLibraryFromDrivePath(newRelPath);
  if (!resolved) return;
  const { library, spRelativePath: newSpRelPath } = resolved;
  const parentSpRelPath = newSpRelPath.split("/").slice(0, -1).join("/");

  const isFolder = file.mimeType === "application/vnd.google-apps.folder";
  const actor = await resolveActorFromDrive(
    file.lastModifyingUser
      ? { emailAddress: file.lastModifyingUser.emailAddress, displayName: file.lastModifyingUser.displayName }
      : undefined,
  );

  if (isFolder) {
    let spItemId: string;
    if (existingMapping?.sharepointItemId) {
      if (existingMapping.relativePath !== newRelPath) {
        const newParentSpId = await graph.ensureFolder(library.driveId, parentSpRelPath);
        spItemId = (
          await graph.moveAndRenameItem(library.driveId, existingMapping.sharepointItemId, newParentSpId, file.name)
        ).id;
      } else {
        spItemId = existingMapping.sharepointItemId;
      }
    } else {
      spItemId = await graph.ensureFolder(library.driveId, newSpRelPath);
    }
    await upsertMapping({
      itemType: "folder",
      relativePath: newRelPath,
      sharepointDriveId: library.driveId,
      sharepointItemId: spItemId,
      driveFileId: file.id,
      direction: "drive_to_sp",
    });
    return;
  }

  if (existingMapping?.driveMd5 && existingMapping.driveMd5 === file.md5Checksum && existingMapping.relativePath === newRelPath) {
    return; // echo of our own SharePoint -> Drive write, or unchanged metadata
  }

  // Conflict check: has SharePoint's copy changed independently?
  if (existingMapping?.sharepointItemId && existingMapping.sharepointHash) {
    const liveItem = await graph.getItemById(library.driveId, existingMapping.sharepointItemId).catch(() => null);
    if (liveItem?.file) {
      const liveHash = await sha256Hex(
        await graph.downloadFileContent(library.driveId, existingMapping.sharepointItemId),
      );
      if (liveHash !== existingMapping.sharepointHash) {
        const content = await drive.downloadFile(file.id);
        await graph.uploadFileContent(
          library.driveId,
          `${parentSpRelPath ? parentSpRelPath + "/" : ""}${conflictFileName(file.name, "Google Drive")}`,
          content,
          file.mimeType,
        );
        await recordConflict(
          existingMapping.id,
          `עודכן גם ב-Drive וגם ב-SharePoint: ${newRelPath}`,
          liveHash,
          file.md5Checksum,
        );
        return;
      }
    }
  }

  const content = await drive.downloadFile(file.id);
  const contentHash = await sha256Hex(content);

  if (existingMapping?.sharepointItemId && existingMapping.relativePath !== newRelPath) {
    const newParentSpId = await graph.ensureFolder(library.driveId, parentSpRelPath);
    await graph.moveAndRenameItem(library.driveId, existingMapping.sharepointItemId, newParentSpId, file.name);
  }
  const spItem = await graph.uploadFileContent(library.driveId, newSpRelPath, content, file.mimeType);

  await upsertMapping({
    itemType: "file",
    relativePath: newRelPath,
    sharepointDriveId: library.driveId,
    sharepointItemId: spItem.id,
    sharepointETag: spItem.eTag,
    sharepointHash: contentHash,
    driveFileId: file.id,
    driveMd5: file.md5Checksum,
    direction: "drive_to_sp",
  });

  const [doc] = await db.select().from(schema.documents).where(eq(schema.documents.driveFileId, file.id)).limit(1);
  if (doc) {
    await db
      .update(schema.documents)
      .set({
        name: file.name,
        relativePath: newRelPath,
        sharepointItemId: spItem.id,
        sharepointETag: spItem.eTag ?? null,
        contentHash,
        driveMd5: file.md5Checksum ?? null,
        version: doc.version + 1,
        lastModifiedByEmployeeId: actor.employeeId,
        lastModifiedAt: new Date().toISOString(),
      })
      .where(eq(schema.documents.id, doc.id));

    await logAction({
      action: "document.sync_update",
      entityType: "document",
      entityId: doc.id,
      employeeId: actor.employeeId,
      actorLabel: actor.employeeId ? undefined : actor.label,
      details: { direction: "drive_to_sharepoint", fileName: file.name },
    });
  }
}
