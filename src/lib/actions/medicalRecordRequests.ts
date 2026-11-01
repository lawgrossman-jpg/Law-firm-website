"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { MedicalRecordRequestStatus } from "@/db/schema";
import { newId } from "@/lib/id";
import { requireSession } from "@/lib/auth/session";
import { logAction } from "@/lib/audit";

export async function createMedicalRecordRequestAction(formData: FormData) {
  const session = await requireSession();

  const caseId = String(formData.get("caseId") ?? "");
  const sourceName = String(formData.get("sourceName") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const assignedToId = String(formData.get("assignedToId") ?? "") || null;
  if (!caseId || !sourceName) return;

  const db = await getDb();
  const id = newId("mrr");
  await db.insert(schema.medicalRecordRequests).values({
    id,
    caseId,
    sourceName,
    description,
    assignedToId,
    status: "requested",
  });

  await logAction({
    action: "medical_record_request.create",
    entityType: "medical_record_request",
    entityId: id,
    employeeId: session.employeeId,
    details: { caseId, sourceName },
  });

  revalidatePath(`/cases/${caseId}`);
}

export async function updateMedicalRecordRequestStatusAction(formData: FormData) {
  const session = await requireSession();

  const requestId = String(formData.get("requestId") ?? "");
  const caseId = String(formData.get("caseId") ?? "");
  const status = String(formData.get("status") ?? "") as MedicalRecordRequestStatus;
  if (!requestId || !caseId) return;

  const db = await getDb();
  const [current] = await db
    .select()
    .from(schema.medicalRecordRequests)
    .where(eq(schema.medicalRecordRequests.id, requestId))
    .limit(1);
  if (!current) return;

  const now = new Date().toISOString();
  await db
    .update(schema.medicalRecordRequests)
    .set({
      status,
      remindersSentCount:
        status === "reminder_sent" ? current.remindersSentCount + 1 : current.remindersSentCount,
      lastReminderAt: status === "reminder_sent" ? now : current.lastReminderAt,
      receivedAt: status === "received" ? now : current.receivedAt,
      sentToExpertAt: status === "sent_to_expert" ? now : current.sentToExpertAt,
    })
    .where(eq(schema.medicalRecordRequests.id, requestId));

  await logAction({
    action: "medical_record_request.update",
    entityType: "medical_record_request",
    entityId: requestId,
    employeeId: session.employeeId,
    details: { status },
  });

  revalidatePath(`/cases/${caseId}`);
}
