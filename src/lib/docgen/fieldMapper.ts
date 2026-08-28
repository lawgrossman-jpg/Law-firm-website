import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";

/** Gathers a flat set of merge fields for a case — party names, ID
 * numbers, proceeding numbers — for use as docxtemplater {tag} values in
 * the document generator (יפוי כוח, כתבי טענות, ...). */
export async function buildCaseMergeData(caseId: string): Promise<Record<string, string>> {
  const db = await getDb();
  const [caseRow] = await db.select().from(schema.cases).where(eq(schema.cases.id, caseId)).limit(1);
  if (!caseRow) throw new Error("case not found");

  const [client] = await db
    .select()
    .from(schema.clients)
    .where(eq(schema.clients.id, caseRow.clientId))
    .limit(1);
  const parties = await db
    .select()
    .from(schema.caseParties)
    .where(eq(schema.caseParties.caseId, caseId));

  const plaintiff = parties.find((p) => p.role === "plaintiff");
  const defendant = parties.find((p) => p.role === "defendant");
  const clientParty = parties.find((p) => p.role === "client");

  let responsible: typeof schema.employees.$inferSelect | undefined;
  if (caseRow.responsibleEmployeeId) {
    [responsible] = await db
      .select()
      .from(schema.employees)
      .where(eq(schema.employees.id, caseRow.responsibleEmployeeId))
      .limit(1);
  }

  return {
    case_number: caseRow.caseNumber,
    case_title: caseRow.title,
    court_case_number: caseRow.courtCaseNumber ?? "",
    client_full_name: client?.fullName ?? clientParty?.fullName ?? "",
    client_id_number: client?.idNumber ?? clientParty?.idNumber ?? "",
    client_address: client?.address ?? clientParty?.address ?? "",
    client_phone: client?.phone ?? clientParty?.phone ?? "",
    plaintiff_full_name: plaintiff?.fullName ?? client?.fullName ?? "",
    defendant_full_name: defendant?.fullName ?? caseRow.opposingParty ?? "",
    responsible_lawyer_name: responsible?.fullName ?? "",
    today_date: new Date().toLocaleDateString("he-IL"),
  };
}
