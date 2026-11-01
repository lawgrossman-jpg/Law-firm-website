"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { newId } from "@/lib/id";
import { requireSession } from "@/lib/auth/session";
import { logAction } from "@/lib/audit";

export async function createDamageHeadAction(formData: FormData) {
  const session = await requireSession();

  const caseId = String(formData.get("caseId") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  const estimatedAmount = Number(formData.get("estimatedAmount") ?? 0) || 0;
  const proposedAmountRaw = String(formData.get("proposedAmount") ?? "").trim();
  const proposedAmount = proposedAmountRaw ? Number(proposedAmountRaw) : null;
  if (!caseId || !label) return;

  const db = await getDb();
  const id = newId("dmg");
  await db.insert(schema.damageHeads).values({
    id,
    caseId,
    label,
    estimatedAmount,
    proposedAmount,
  });

  await logAction({
    action: "damage_head.create",
    entityType: "damage_head",
    entityId: id,
    employeeId: session.employeeId,
    details: { caseId, label, estimatedAmount, proposedAmount },
  });

  revalidatePath(`/cases/${caseId}`);
}

export async function updateDamageHeadAction(formData: FormData) {
  const session = await requireSession();

  const id = String(formData.get("id") ?? "");
  const caseId = String(formData.get("caseId") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  const estimatedAmount = Number(formData.get("estimatedAmount") ?? 0) || 0;
  const proposedAmountRaw = String(formData.get("proposedAmount") ?? "").trim();
  const proposedAmount = proposedAmountRaw ? Number(proposedAmountRaw) : null;
  if (!id || !caseId || !label) return;

  const db = await getDb();
  await db
    .update(schema.damageHeads)
    .set({ label, estimatedAmount, proposedAmount })
    .where(eq(schema.damageHeads.id, id));

  await logAction({
    action: "damage_head.update",
    entityType: "damage_head",
    entityId: id,
    employeeId: session.employeeId,
    details: { label, estimatedAmount, proposedAmount },
  });

  revalidatePath(`/cases/${caseId}`);
}

export async function deleteDamageHeadAction(formData: FormData) {
  const session = await requireSession();

  const id = String(formData.get("id") ?? "");
  const caseId = String(formData.get("caseId") ?? "");
  if (!id || !caseId) return;

  const db = await getDb();
  await db.delete(schema.damageHeads).where(eq(schema.damageHeads.id, id));

  await logAction({
    action: "damage_head.delete",
    entityType: "damage_head",
    entityId: id,
    employeeId: session.employeeId,
    details: { caseId },
  });

  revalidatePath(`/cases/${caseId}`);
}
