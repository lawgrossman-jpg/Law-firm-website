"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { CaseStatus, CasePartyRole } from "@/db/schema";
import { newId } from "@/lib/id";
import { requireSession } from "@/lib/auth/session";
import { logAction } from "@/lib/audit";
import { nextCaseNumber } from "@/lib/cases/caseNumber";
import { caseFolderName } from "@/lib/cases/slug";
import { provisionCaseFolders } from "@/lib/cases/provision";
import { scheduleTasksForCase } from "@/lib/cases/scheduleTasks";
import { createClientAction } from "@/lib/actions/clients";

export type CaseFormState = { error?: string } | undefined;

export async function createCaseAction(
  _prevState: CaseFormState,
  formData: FormData,
): Promise<CaseFormState> {
  const session = await requireSession();

  const title = String(formData.get("title") ?? "").trim();
  const caseTypeId = String(formData.get("caseTypeId") ?? "") || null;
  const opposingParty = String(formData.get("opposingParty") ?? "").trim() || null;
  const courtCaseNumber = String(formData.get("courtCaseNumber") ?? "").trim() || null;
  const responsibleEmployeeId = String(formData.get("responsibleEmployeeId") ?? "") || null;

  let clientId = String(formData.get("clientId") ?? "") || null;
  const newClientName = String(formData.get("newClientName") ?? "").trim();

  if (!title) return { error: "יש להזין כותרת לתיק" };
  if (!clientId && !newClientName) return { error: "יש לבחור לקוח קיים או להזין לקוח חדש" };

  if (!clientId && newClientName) {
    clientId = await createClientAction({
      fullName: newClientName,
      idNumber: String(formData.get("newClientIdNumber") ?? "").trim() || undefined,
      phone: String(formData.get("newClientPhone") ?? "").trim() || undefined,
      email: String(formData.get("newClientEmail") ?? "").trim() || undefined,
    });
  }

  const db = await getDb();
  const caseNumber = await nextCaseNumber();
  const folderPath = `Cases/${caseFolderName(caseNumber, title)}`;
  const caseId = newId("case");

  await db.insert(schema.cases).values({
    id: caseId,
    caseNumber,
    title,
    caseTypeId,
    clientId: clientId!,
    courtCaseNumber,
    opposingParty,
    status: "open" as CaseStatus,
    responsibleEmployeeId,
    folderPath,
  });

  if (opposingParty) {
    await db.insert(schema.caseParties).values({
      id: newId("party"),
      caseId,
      role: "defendant" as CasePartyRole,
      fullName: opposingParty,
    });
  }
  const [client] = await db
    .select()
    .from(schema.clients)
    .where(eq(schema.clients.id, clientId!))
    .limit(1);
  if (client) {
    await db.insert(schema.caseParties).values({
      id: newId("party"),
      caseId,
      role: "client" as CasePartyRole,
      fullName: client.fullName,
      idNumber: client.idNumber,
      address: client.address,
      phone: client.phone,
    });
  }

  await scheduleTasksForCase(caseId);

  let provisionError: string | undefined;
  try {
    await provisionCaseFolders(caseId);
  } catch (err) {
    provisionError = err instanceof Error ? err.message : String(err);
    console.error("provisionCaseFolders failed", err);
  }

  await logAction({
    action: "case.create",
    entityType: "case",
    entityId: caseId,
    employeeId: session.employeeId,
    details: { caseNumber, title, provisionError },
  });

  redirect(
    `/cases/${caseId}${provisionError ? "?provisionError=" + encodeURIComponent(provisionError) : ""}`,
  );
}

export async function updateCaseStatusAction(formData: FormData) {
  const session = await requireSession();
  const caseId = String(formData.get("caseId"));
  const status = String(formData.get("status")) as CaseStatus;

  const db = await getDb();
  await db
    .update(schema.cases)
    .set({ status, closedAt: status === "closed" ? new Date().toISOString() : null })
    .where(eq(schema.cases.id, caseId));

  await logAction({
    action: status === "closed" ? "case.close" : "case.update",
    entityType: "case",
    entityId: caseId,
    employeeId: session.employeeId,
    details: { status },
  });
}
