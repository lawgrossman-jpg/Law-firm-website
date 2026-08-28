import Link from "next/link";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { NewTaskInlineForm } from "./new-task-inline-form";
import { TaskStatusSelect } from "./task-status-select";

export default async function TasksPage() {
  const db = await getDb();
  const [allTasks, employees, cases] = await Promise.all([
    db.select().from(schema.tasks).orderBy(schema.tasks.dueDate),
    db.select().from(schema.employees).where(eq(schema.employees.active, true)),
    db.select().from(schema.cases),
  ]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-slate-900">משימות</h1>

      <NewTaskInlineForm employees={employees.map((e) => ({ id: e.id, fullName: e.fullName }))} />

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-right text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">כותרת</th>
              <th className="px-4 py-2 font-medium">תיק</th>
              <th className="px-4 py-2 font-medium">אחראי</th>
              <th className="px-4 py-2 font-medium">תאריך יעד</th>
              <th className="px-4 py-2 font-medium">עדיפות</th>
              <th className="px-4 py-2 font-medium">סטטוס</th>
            </tr>
          </thead>
          <tbody>
            {allTasks.length === 0 && (
              <tr>
                <td className="px-4 py-3 text-slate-400" colSpan={6}>
                  אין משימות
                </td>
              </tr>
            )}
            {allTasks.map((t) => {
              const overdue = t.dueDate && t.dueDate < today && t.status !== "done";
              const relatedCase = cases.find((c) => c.id === t.caseId);
              return (
                <tr key={t.id} className="border-t border-slate-100">
                  <td className="px-4 py-2">{t.title}</td>
                  <td className="px-4 py-2">
                    {relatedCase ? (
                      <Link href={`/cases/${relatedCase.id}`} className="text-slate-600 underline">
                        {relatedCase.caseNumber}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {employees.find((e) => e.id === t.assignedToId)?.fullName ?? "—"}
                  </td>
                  <td className={`px-4 py-2 ${overdue ? "font-medium text-red-600" : ""}`}>
                    {t.dueDate ?? "—"}
                  </td>
                  <td className="px-4 py-2">{t.priority}</td>
                  <td className="px-4 py-2">
                    <TaskStatusSelect taskId={t.id} caseId={t.caseId} status={t.status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
