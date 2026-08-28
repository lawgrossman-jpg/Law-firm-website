import "server-only";
import { sql } from "drizzle-orm";
import { getDb, schema } from "@/db";

/** Generates the next sequential case number for the current year, e.g.
 * "2026-014". Not strictly race-proof under heavy concurrency, but the
 * cases.case_number unique constraint means a collision fails loudly
 * rather than silently overwriting another case. */
export async function nextCaseNumber(): Promise<string> {
  const db = await getDb();
  const year = new Date().getFullYear();
  const prefix = `${year}-`;

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.cases)
    .where(sql`${schema.cases.caseNumber} LIKE ${prefix + "%"}`);

  const next = (count ?? 0) + 1;
  return `${prefix}${String(next).padStart(3, "0")}`;
}
