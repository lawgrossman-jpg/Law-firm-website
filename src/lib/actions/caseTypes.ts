"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { EmployeeRole } from "@/db/schema";
import { newId } from "@/lib/id";
import { requireRole } from "@/lib/auth/session";
import { logAction } from "@/lib/audit";

export type CaseTypeFormState = { error?: string } | undefined;

type TaskTemplateItem = {
  title: string;
  description?: string;
  dueOffsetDays: number;
  assigneeRole?: EmployeeRole;
};

function parseFolderTemplate(formData: FormData): string[] {
  return String(formData.get("folderTemplate") ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseTaskTemplate(formData: FormData): TaskTemplateItem[] {
  const titles = formData.getAll("taskTitle").map(String);
  const descriptions = formData.getAll("taskDescription").map(String);
  const dueOffsetDays = formData.getAll("taskDueOffsetDays").map(String);
  const assigneeRoles = formData.getAll("taskAssigneeRole").map(String);

  const items: TaskTemplateItem[] = [];
  for (let i = 0; i < titles.length; i++) {
    const title = titles[i].trim();
    if (!title) continue;
    const description = descriptions[i]?.trim();
    const assigneeRole = assigneeRoles[i]?.trim();
    items.push({
      title,
      description: description || undefined,
      dueOffsetDays: Number(dueOffsetDays[i]) || 0,
      assigneeRole: (assigneeRole || undefined) as EmployeeRole | undefined,
    });
  }
  return items;
}

export async function createCaseTypeAction(
  _prevState: CaseTypeFormState,
  formData: FormData,
): Promise<CaseTypeFormState> {
  const session = await requireRole("partner");

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  if (!name) {
    return { error: "יש למלא שם לסוג התיק" };
  }

  const id = newId("ctype");
  const db = await getDb();
  await db.insert(schema.caseTypes).values({
    id,
    name,
    description,
    folderTemplate: parseFolderTemplate(formData),
    taskTemplate: parseTaskTemplate(formData),
  });

  await logAction({
    action: "case_type.create",
    entityType: "case_type",
    entityId: id,
    employeeId: session.employeeId,
    details: { name },
  });

  revalidatePath("/admin/case-types");
}

export async function updateCaseTypeAction(
  _prevState: CaseTypeFormState,
  formData: FormData,
): Promise<CaseTypeFormState> {
  const session = await requireRole("partner");

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  if (!id || !name) {
    return { error: "יש למלא שם לסוג התיק" };
  }

  const db = await getDb();
  await db
    .update(schema.caseTypes)
    .set({
      name,
      description,
      folderTemplate: parseFolderTemplate(formData),
      taskTemplate: parseTaskTemplate(formData),
    })
    .where(eq(schema.caseTypes.id, id));

  await logAction({
    action: "case_type.update",
    entityType: "case_type",
    entityId: id,
    employeeId: session.employeeId,
    details: { name },
  });

  revalidatePath("/admin/case-types");
}
