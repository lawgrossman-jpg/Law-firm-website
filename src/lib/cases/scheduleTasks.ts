import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { newId } from "@/lib/id";

/** Auto-generates the case type's scheduled task list, offsetting each
 * task's due date from the case's opened date, and pre-assigning a task to
 * the case's responsible employee when their role matches the template. */
export async function scheduleTasksForCase(caseId: string): Promise<void> {
  const db = await getDb();
  const [caseRow] = await db
    .select()
    .from(schema.cases)
    .where(eq(schema.cases.id, caseId))
    .limit(1);
  if (!caseRow?.caseTypeId) return;

  const [caseType] = await db
    .select()
    .from(schema.caseTypes)
    .where(eq(schema.caseTypes.id, caseRow.caseTypeId))
    .limit(1);
  if (!caseType) return;

  let responsible: typeof schema.employees.$inferSelect | undefined;
  if (caseRow.responsibleEmployeeId) {
    [responsible] = await db
      .select()
      .from(schema.employees)
      .where(eq(schema.employees.id, caseRow.responsibleEmployeeId))
      .limit(1);
  }

  const openedAt = new Date(caseRow.openedAt);

  for (const t of caseType.taskTemplate) {
    const due = new Date(openedAt);
    due.setDate(due.getDate() + t.dueOffsetDays);

    const assignedToId =
      t.assigneeRole && responsible?.role === t.assigneeRole ? responsible.id : null;

    await db.insert(schema.tasks).values({
      id: newId("task"),
      caseId,
      title: t.title,
      description: t.description ?? null,
      dueDate: due.toISOString().slice(0, 10),
      assignedToId,
      status: "pending",
      priority: "normal",
    });
  }
}
