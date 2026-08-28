import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDriveAccessToken } from "./token";

const DRIVE_BASE = "https://www.googleapis.com/drive/v3";
const UPLOAD_BASE = "https://www.googleapis.com/upload/drive/v3";

export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  md5Checksum?: string;
  modifiedTime?: string;
  parents?: string[];
  trashed?: boolean;
  lastModifyingUser?: { displayName?: string; emailAddress?: string };
};

async function rootFolderId(): Promise<string> {
  const { env } = await getCloudflareContext({ async: true });
  return env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
}

async function driveFetch(
  path: string,
  init: RequestInit = {},
  actAsEmail?: string,
): Promise<Response> {
  const token = await getDriveAccessToken(actAsEmail);
  const url = path.startsWith("http") ? path : `${DRIVE_BASE}${path}`;
  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });
}

function escapeForQuery(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

/** Finds a direct child of `parentId` by exact name (folder or file). */
export async function findChild(
  parentId: string,
  name: string,
  opts: { foldersOnly?: boolean } = {},
): Promise<DriveFile | null> {
  const typeFilter = opts.foldersOnly
    ? " and mimeType='application/vnd.google-apps.folder'"
    : "";
  const q = `'${parentId}' in parents and name='${escapeForQuery(name)}' and trashed=false${typeFilter}`;
  const res = await driveFetch(
    `/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,md5Checksum,modifiedTime,parents)&pageSize=1`,
  );
  if (!res.ok) throw new Error(`findChild failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { files: DriveFile[] };
  return data.files[0] ?? null;
}

/** Creates a folder (idempotent) under `parentId` and returns its id. */
export async function ensureFolder(parentId: string, name: string): Promise<string> {
  const existing = await findChild(parentId, name, { foldersOnly: true });
  if (existing) return existing.id;

  const res = await driveFetch("/files?fields=id", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    }),
  });
  if (!res.ok) throw new Error(`ensureFolder failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { id: string };
  return data.id;
}

/** Walks/creates a full relative path (e.g. "Cases/2026-014-Cohen/כתבי
 * טענות") starting under the shared root folder, returning the final
 * folder's id. Mirrors the SharePoint folder tree 1:1. */
export async function ensureFolderPath(relativePath: string): Promise<string> {
  let currentId = await rootFolderId();
  for (const segment of relativePath.split("/").filter(Boolean)) {
    currentId = await ensureFolder(currentId, segment);
  }
  return currentId;
}

/** Creates or replaces (by fileId) a file's content and metadata.
 *
 * `actAsEmail`, when given, uploads impersonating that Workspace user
 * (via domain-wide delegation) so Drive's own `lastModifyingUser` credits
 * them — used to carry a SharePoint editor's identity over to the Drive
 * side. See getDriveAccessToken(). */
export async function uploadFile(params: {
  name: string;
  parentId?: string;
  content: ArrayBuffer | Uint8Array;
  mimeType: string;
  existingFileId?: string;
  actAsEmail?: string;
}): Promise<DriveFile> {
  const metadata: Record<string, unknown> = { name: params.name };
  if (params.parentId && !params.existingFileId) metadata.parents = [params.parentId];

  const boundary = `lfm-${crypto.randomUUID()}`;
  const encoder = new TextEncoder();
  const contentBytes =
    params.content instanceof Uint8Array ? params.content : new Uint8Array(params.content);

  const head = encoder.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(
      metadata,
    )}\r\n--${boundary}\r\nContent-Type: ${params.mimeType}\r\n\r\n`,
  );
  const tail = encoder.encode(`\r\n--${boundary}--`);
  const body = new Uint8Array(head.length + contentBytes.length + tail.length);
  body.set(head, 0);
  body.set(contentBytes, head.length);
  body.set(tail, head.length + contentBytes.length);

  const path = params.existingFileId
    ? `/files/${params.existingFileId}?uploadType=multipart&fields=id,name,mimeType,md5Checksum,modifiedTime`
    : `/files?uploadType=multipart&fields=id,name,mimeType,md5Checksum,modifiedTime`;
  const method = params.existingFileId ? "PATCH" : "POST";

  const token = await getDriveAccessToken(params.actAsEmail);
  const res = await fetch(`${UPLOAD_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body: body as BodyInit,
  });
  if (!res.ok) throw new Error(`uploadFile failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function downloadFile(fileId: string): Promise<ArrayBuffer> {
  const res = await driveFetch(`/files/${fileId}?alt=media`);
  if (!res.ok) throw new Error(`downloadFile failed: ${res.status} ${await res.text()}`);
  return res.arrayBuffer();
}

export async function getFileMetadata(fileId: string): Promise<DriveFile> {
  const res = await driveFetch(
    `/files/${fileId}?fields=id,name,mimeType,md5Checksum,modifiedTime,parents,trashed,lastModifyingUser`,
  );
  if (!res.ok) throw new Error(`getFileMetadata failed: ${res.status} ${await res.text()}`);
  return res.json();
}

/** Moves a file/folder to a new parent and/or renames it (mirrors a
 * SharePoint move/rename). Pass the item's current parent id so it can be
 * removed from `addParents`/`removeParents` correctly. */
export async function moveAndRename(params: {
  fileId: string;
  newParentId: string;
  oldParentId?: string;
  newName: string;
  actAsEmail?: string;
}): Promise<DriveFile> {
  const query = new URLSearchParams({ addParents: params.newParentId, fields: "id,name,parents" });
  if (params.oldParentId) query.set("removeParents", params.oldParentId);
  const res = await driveFetch(
    `/files/${params.fileId}?${query.toString()}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: params.newName }),
    },
    params.actAsEmail,
  );
  if (!res.ok) throw new Error(`moveAndRename failed: ${res.status} ${await res.text()}`);
  return res.json();
}

/** Moves a file/folder to Drive's trash (mirrors a SharePoint delete). */
export async function trashFile(fileId: string, actAsEmail?: string): Promise<void> {
  const res = await driveFetch(
    `/files/${fileId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trashed: true }),
    },
    actAsEmail,
  );
  if (!res.ok && res.status !== 404) {
    throw new Error(`trashFile failed: ${res.status} ${await res.text()}`);
  }
}

export async function getStartPageToken(): Promise<string> {
  const res = await driveFetch("/changes/startPageToken");
  if (!res.ok) throw new Error(`getStartPageToken failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { startPageToken: string };
  return data.startPageToken;
}

export type DriveChange = {
  fileId: string;
  removed: boolean;
  file?: DriveFile;
};

export async function listChanges(
  pageToken: string,
): Promise<{ changes: DriveChange[]; newStartPageToken?: string; nextPageToken?: string }> {
  const res = await driveFetch(
    `/changes?pageToken=${encodeURIComponent(pageToken)}&fields=newStartPageToken,nextPageToken,changes(fileId,removed,file(id,name,mimeType,md5Checksum,modifiedTime,parents,trashed,lastModifyingUser))`,
  );
  if (!res.ok) throw new Error(`listChanges failed: ${res.status} ${await res.text()}`);
  return res.json();
}

/** Registers a Drive push-notification channel watching the whole
 * "changes" feed. Channels expire (max ~24h unless a longer expiration is
 * granted) and must be renewed (see /api/cron/tick). */
export async function watchChanges(params: {
  pageToken: string;
  channelId: string;
  webhookUrl: string;
  expirationEpochMs: number;
  token: string;
}): Promise<{ resourceId: string; expiration: string }> {
  const res = await driveFetch(
    `/changes/watch?pageToken=${encodeURIComponent(params.pageToken)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: params.channelId,
        type: "web_hook",
        address: params.webhookUrl,
        expiration: String(params.expirationEpochMs),
        token: params.token,
      }),
    },
  );
  if (!res.ok) throw new Error(`watchChanges failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function getRootFolderId(): Promise<string> {
  return rootFolderId();
}
