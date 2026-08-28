/** Generates a URL-safe unique id (used as primary key text across all tables). */
export function newId(prefix?: string): string {
  const uuid = crypto.randomUUID();
  return prefix ? `${prefix}_${uuid}` : uuid;
}
