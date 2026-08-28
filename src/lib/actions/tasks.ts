"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { TaskStatus } from "@/db/schema";
import { newId } from "@/lib/id";
import { requireSession } from "@/lib/auth/session";
import { logAction } from "@/lib/audit";

export async function createTaskAction(formData: FormData) {
  const session = await requireSession();

  const caseId = String(formData.get("caseId") ?? "") || null;
  const title = String(formData.get("title") ?? "").trim();
  const dueDate = String(formData.get("dueDate") ?? "") || null;
  const assignedToId = String(formData.get("assignedToId") ?? "") || null;
  const priority = String(formData.get("priority") ?? "normal");
  if (!title) return;

  const db = await getDb();
  const id = newId("task");
  await db.insert(schema.tasks).values({
    id,
    caseId,
    title,
    dueDate,
    assignedToId,
    priority: priority as (typeof schema.taskPriorities)[number],
    status: "pending",
  });

  await logAction({
    action: "task.create",
    entityType: "task",
    entityId: id,
    employeeId: session.employeeId,
    details: { title, caseId },
  });

  revalidatePath("/tasks");
  if (caseId) revalidatePath(`/cases/${caseId}`);
}

export async function updateTaskStatusAction(formData: FormData) {
  const session = await requireSession();
  const taskId = String(formData.get("taskId"));
  const status = String(formData.get("status")) as TaskStatus;
  const caseId = String(formData.get("caseId") ?? "") || null;

  const db = await getDb();
  await db
    .update(schema.tasks)
    .set({ status, completedAt: status === "done" ? new Date().toISOString() : null })
    .where(eq(schema.tasks.id, taskId));

  await logAction({
    action: "task.update",
    entityType: "task",
    entityId: taskId,
    employeeId: session.employeeId,
    details: { status },
  });

  revalidatePath("/tasks");
  if (caseId) revalidatePath(`/cases/${caseId}`);
}
