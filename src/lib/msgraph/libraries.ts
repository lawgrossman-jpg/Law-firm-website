import "server-only";
import { eq, and } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb, schema } from "@/db";
import { newId } from "@/lib/id";
import * as graph from "@/lib/msgraph/client";

export type SharepointLibrary = typeof schema.sharepointLibraries.$inferSelect;

export async function listEnabledLibraries(): Promise<SharepointLibrary[]> {
  const db = await getDb();
  return db
    .select()
    .from(schema.sharepointLibraries)
    .where(eq(schema.sharepointLibraries.enabled, true));
}

/** The single library new case folders are auto-provisioned into
 * (normally "תיקים פתוחים"). Throws if none is configured. */
export async function getPrimaryCaseLibrary(): Promise<SharepointLibrary> {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(schema.sharepointLibraries)
    .where(
      and(
        eq(schema.sharepointLibraries.isPrimaryForCases, true),
        eq(schema.sharepointLibraries.enabled, true),
      ),
    )
    .limit(1);
  if (!row) {
    throw new Error(
      "No primary case library configured (sharepoint_libraries.is_primary_for_cases) — see /admin/sync",
    );
  }
  return row;
}

export async function getLibraryByDriveId(driveId: string): Promise<SharepointLibrary | undefined> {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(schema.sharepointLibraries)
    .where(eq(schema.sharepointLibraries.driveId, driveId))
    .limit(1);
  return row;
}

/** Queries the SharePoint site for its current list of document libraries
 * and inserts any not yet known to us (enabled by default, not marked
 * primary-for-cases). Existing libraries are left untouched — this only
 * adds new ones, it never disables or renames. Call this from the hourly
 * cron tick so a library created later in SharePoint (a new matter type, a
 * new shared folder, ...) starts getting synced automatically within the
 * hour, with no manual re-seed. */
export async function discoverLibraries(): Promise<{ added: string[] }> {
  const db = await getDb();
  const { env } = await getCloudflareContext({ async: true });

  const [siteDrives, known] = await Promise.all([
    graph.listSiteDrives(env.MS_SHAREPOINT_SITE_ID),
    db.select({ driveId: schema.sharepointLibraries.driveId }).from(schema.sharepointLibraries),
  ]);
  const knownDriveIds = new Set(known.map((k) => k.driveId));

  const added: string[] = [];
  for (const drive of siteDrives) {
    if (knownDriveIds.has(drive.id)) continue;
    await db.insert(schema.sharepointLibraries).values({
      id: newId("splib"),
      driveId: drive.id,
      name: drive.name,
      isPrimaryForCases: false,
      enabled: true,
    });
    added.push(drive.name);
  }
  return { added };
}

/** Given a path relative to the shared Google Drive root (which always
 * starts with a library's `name` as its first segment), resolves which
 * library owns it and the path relative to that library's own SharePoint
 * root (i.e. with the library-name prefix stripped). Returns null if the
 * first segment doesn't match any known library (untracked content). */
export async function resolveLibraryFromDrivePath(
  driveRelativePath: string,
): Promise<{ library: SharepointLibrary; spRelativePath: string } | null> {
  const libraries = await listEnabledLibraries();
  for (const library of libraries) {
    if (driveRelativePath === library.name) {
      return { library, spRelativePath: "" };
    }
    if (driveRelativePath.startsWith(`${library.name}/`)) {
      return { library, spRelativePath: driveRelativePath.slice(library.name.length + 1) };
    }
  }
  return null;
}
