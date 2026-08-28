/** Computes a lowercase hex SHA-256 digest, used as our provider-agnostic
 * content hash for detecting real changes vs. metadata-only updates and
 * for conflict detection between SharePoint and Drive copies. */
export async function sha256Hex(data: ArrayBuffer | Uint8Array): Promise<string> {
  const buf =
    data instanceof Uint8Array
      ? (data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer)
      : data;
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
