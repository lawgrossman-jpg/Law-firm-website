import "server-only";
import { getGraphAccessToken } from "./token";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

export type GraphDriveItem = {
  id: string;
  name: string;
  eTag?: string;
  size?: number;
  file?: { mimeType?: string; hashes?: { quickXorHash?: string } };
  folder?: { childCount?: number };
  parentReference?: { path?: string };
  lastModifiedBy?: {
    user?: { id?: string; displayName?: string; email?: string };
  };
  lastModifiedDateTime?: string;
  deleted?: { state?: string };
};

export type GraphDeltaPage = {
  value: GraphDriveItem[];
  nextLink?: string;
  deltaLink?: string;
};

// Every function below is scoped to a single SharePoint document library
// (drive), passed explicitly as `driveId` — this firm's SharePoint site has
// many libraries (תיקים פתוחים, תיקים סגורים, פסיקה, ...), all synced in
// parallel; which ones are active lives in the sharepoint_libraries table
// (see src/lib/msgraph/libraries.ts), not in a single env var.

async function graphFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getGraphAccessToken();
  const url = path.startsWith("http") ? path : `${GRAPH_BASE}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });
  return res;
}

function encodeItemPath(relativePath: string): string {
  return relativePath
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");
}

/** Fetches an item's metadata by path relative to the document library
 * root (e.g. "2026-014-Cohen/כתבי טענות"). Returns null if missing. */
export async function getItemByPath(
  driveId: string,
  relativePath: string,
): Promise<GraphDriveItem | null> {
  const encoded = encodeItemPath(relativePath);
  const path = encoded ? `/drives/${driveId}/root:/${encoded}` : `/drives/${driveId}/root`;
  const res = await graphFetch(path);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`getItemByPath failed: ${res.status} ${await res.text()}`);
  return res.json();
}

/** Creates a folder (idempotent) at `relativePath`, creating parents as
 * needed, and returns its item id. */
export async function ensureFolder(driveId: string, relativePath: string): Promise<string> {
  const segments = relativePath.split("/").filter(Boolean);
  let currentPath = "";
  let currentId: string | null = null;

  for (const segment of segments) {
    const parentPath = currentPath;
    currentPath = currentPath ? `${currentPath}/${segment}` : segment;

    const existing = await getItemByPath(driveId, currentPath);
    if (existing) {
      currentId = existing.id;
      continue;
    }

    const childrenPath = parentPath
      ? `/drives/${driveId}/root:/${encodeItemPath(parentPath)}:/children`
      : `/drives/${driveId}/root/children`;

    const res = await graphFetch(childrenPath, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: segment,
        folder: {},
        "@microsoft.graph.conflictBehavior": "fail",
      }),
    });

    if (res.status === 409) {
      // Created concurrently — fetch it.
      const item = await getItemByPath(driveId, currentPath);
      if (!item) throw new Error(`ensureFolder: conflict but item not found at ${currentPath}`);
      currentId = item.id;
      continue;
    }
    if (!res.ok) throw new Error(`ensureFolder failed: ${res.status} ${await res.text()}`);
    const created = (await res.json()) as GraphDriveItem;
    currentId = created.id;
  }

  if (!currentId) throw new Error("ensureFolder: empty relativePath");
  return currentId;
}

/** Uploads small (<4MB) file content to `relativePath`, creating or
 * replacing it. Suitable for generated documents and scanned pages. */
export async function uploadFileContent(
  driveId: string,
  relativePath: string,
  content: ArrayBuffer | Uint8Array,
  mimeType = "application/octet-stream",
): Promise<GraphDriveItem> {
  const encoded = encodeItemPath(relativePath);
  const res = await graphFetch(`/drives/${driveId}/root:/${encoded}:/content`, {
    method: "PUT",
    headers: { "Content-Type": mimeType },
    body: content as BodyInit,
  });
  if (!res.ok) throw new Error(`uploadFileContent failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function downloadFileContent(driveId: string, itemId: string): Promise<ArrayBuffer> {
  const res = await graphFetch(`/drives/${driveId}/items/${itemId}/content`);
  if (!res.ok) throw new Error(`downloadFileContent failed: ${res.status} ${await res.text()}`);
  return res.arrayBuffer();
}

/** Moves/renames an item (mirrors a Google Drive move/rename) by patching
 * its parentReference + name. `newParentItemId` is the Graph item id of
 * the destination folder (e.g. from ensureFolder(driveId, newParentPath)). */
export async function moveAndRenameItem(
  driveId: string,
  itemId: string,
  newParentItemId: string,
  newName: string,
): Promise<GraphDriveItem> {
  const res = await graphFetch(`/drives/${driveId}/items/${itemId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      parentReference: { id: newParentItemId },
      name: newName,
    }),
  });
  if (!res.ok) throw new Error(`moveAndRenameItem failed: ${res.status} ${await res.text()}`);
  return res.json();
}

/** Deletes an item (mirrors a Google Drive trash/delete). */
export async function deleteItem(driveId: string, itemId: string): Promise<void> {
  const res = await graphFetch(`/drives/${driveId}/items/${itemId}`, { method: "DELETE" });
  if (!res.ok && res.status !== 404) {
    throw new Error(`deleteItem failed: ${res.status} ${await res.text()}`);
  }
}

export async function getItemById(driveId: string, itemId: string): Promise<GraphDriveItem> {
  const res = await graphFetch(`/drives/${driveId}/items/${itemId}`);
  if (!res.ok) throw new Error(`getItemById failed: ${res.status} ${await res.text()}`);
  return res.json();
}

/** Lists direct children of a folder given by path (used by the initial
 * full-tree migration walk). */
export async function listChildren(
  driveId: string,
  relativePath: string,
): Promise<GraphDriveItem[]> {
  const encoded = encodeItemPath(relativePath);
  const base = encoded
    ? `/drives/${driveId}/root:/${encoded}:/children`
    : `/drives/${driveId}/root/children`;
  const out: GraphDriveItem[] = [];
  let next: string | undefined = `${base}?$top=200`;
  while (next) {
    const res: Response = await graphFetch(next);
    if (!res.ok) throw new Error(`listChildren failed: ${res.status} ${await res.text()}`);
    const page: { value: GraphDriveItem[]; "@odata.nextLink"?: string } = await res.json();
    out.push(...page.value);
    next = page["@odata.nextLink"];
  }
  return out;
}

/** Follows a delta link (or starts a fresh delta from the drive root) to
 * get all changes since the last sync. Store the returned `deltaLink` and
 * pass it back in as `link` on the next call. */
export async function deltaQuery(driveId: string, link?: string): Promise<GraphDeltaPage> {
  const startPath = link ?? `/drives/${driveId}/root/delta`;
  const res = await graphFetch(startPath);
  if (!res.ok) throw new Error(`deltaQuery failed: ${res.status} ${await res.text()}`);
  const page = (await res.json()) as {
    value: GraphDriveItem[];
    "@odata.nextLink"?: string;
    "@odata.deltaLink"?: string;
  };
  return {
    value: page.value,
    nextLink: page["@odata.nextLink"],
    deltaLink: page["@odata.deltaLink"],
  };
}

/** Registers a Graph change-notification (webhook) subscription for one
 * document library. Max lifetime for driveItem resources is ~3 days, so
 * this must be renewed periodically (see /api/cron/tick). */
export async function createSubscription(params: {
  driveId: string;
  notificationUrl: string;
  clientState: string;
  expirationDateTime: string;
}): Promise<{ id: string; expirationDateTime: string }> {
  const res = await graphFetch("/subscriptions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      changeType: "updated",
      notificationUrl: params.notificationUrl,
      resource: `/drives/${params.driveId}/root`,
      expirationDateTime: params.expirationDateTime,
      clientState: params.clientState,
    }),
  });
  if (!res.ok) throw new Error(`createSubscription failed: ${res.status} ${await res.text()}`);
  return res.json();
}

/** Lists every document library (drive) on a SharePoint site — used to
 * auto-discover newly created libraries so they get picked up for sync
 * without a manual re-seed (see msgraph/libraries.ts discoverLibraries). */
export async function listSiteDrives(
  siteId: string,
): Promise<Array<{ id: string; name: string }>> {
  const out: Array<{ id: string; name: string }> = [];
  let next: string | undefined = `/sites/${siteId}/drives?$select=id,name&$top=200`;
  while (next) {
    const res: Response = await graphFetch(next);
    if (!res.ok) throw new Error(`listSiteDrives failed: ${res.status} ${await res.text()}`);
    const page: { value: Array<{ id: string; name: string }>; "@odata.nextLink"?: string } =
      await res.json();
    out.push(...page.value);
    next = page["@odata.nextLink"];
  }
  return out;
}

export async function renewSubscription(
  subscriptionId: string,
  expirationDateTime: string,
): Promise<void> {
  const res = await graphFetch(`/subscriptions/${subscriptionId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expirationDateTime }),
  });
  if (!res.ok) throw new Error(`renewSubscription failed: ${res.status} ${await res.text()}`);
}

/** Computes the relative path of a driveItem's *parent* folder (from the
 * library root) — everything itemRelativePath returns, minus the item's
 * own name. Empty string means the parent is the library root. */
export function itemParentRelativePath(item: GraphDriveItem): string {
  const parentPath = item.parentReference?.path ?? "";
  const marker = "root:";
  const idx = parentPath.indexOf(marker);
  return idx >= 0 ? parentPath.slice(idx + marker.length).replace(/^\//, "") : "";
}

/** Computes the relative path (from the library root) for a driveItem,
 * combining its parentReference.path with its own name. */
export function itemRelativePath(item: GraphDriveItem): string {
  const parentPath = item.parentReference?.path ?? "";
  // parentPath looks like "/drives/{id}/root:" or "/drives/{id}/root:/foo"
  const marker = "root:";
  const idx = parentPath.indexOf(marker);
  const relParent = idx >= 0 ? parentPath.slice(idx + marker.length).replace(/^\//, "") : "";
  return relParent ? `${relParent}/${item.name}` : item.name;
}
