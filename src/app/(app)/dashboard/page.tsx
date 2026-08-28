import Link from "next/link";
import { and, desc, eq, ne } from "drizzle-orm";
import { getDb, schema } from "@/db";

export default async function DashboardPage() {
  const db = await getDb();

  const [openCases, pendingTasks, recentAudit] = await Promise.all([
    db.select().from(schema.cases).where(eq(schema.cases.status, "open")),
    db
      .select()
      .from(schema.tasks)
      .where(and(ne(schema.tasks.status, "done"), ne(schema.tasks.status, "cancelled")))
      .orderBy(schema.tasks.dueDate)
      .limit(8),
    db
      .select({
        id: schema.auditLog.id,
        action: schema.auditLog.action,
        entityType: schema.auditLog.entityType,
        actorLabel: schema.auditLog.actorLabel,
        createdAt: schema.auditLog.createdAt,
        employeeName: schema.employees.fullName,
      })
      .from(schema.auditLog)
      .leftJoin(schema.employees, eq(schema.auditLog.employeeId, schema.employees.id))
      .orderBy(desc(schema.auditLog.createdAt))
      .limit(8),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const overdueCount = pendingTasks.filter((t) => t.dueDate && t.dueDate < today).length;

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold text-slate-900">לוח בקרה</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="תיקים פתוחים" value={openCases.length} href="/cases" />
        <StatCard label="משימות פתוחות" value={pendingTasks.length} href="/tasks" />
        <StatCard label="משימות באיחור" value={overdueCount} href="/tasks" tone="danger" />
      </div>

      <section>
        <h2 className="mb-3 text-lg font-medium text-slate-900">משימות קרובות</h2>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-right text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">כותרת</th>
                <th className="px-4 py-2 font-medium">תאריך יעד</th>
                <th className="px-4 py-2 font-medium">סטטוס</th>
              </tr>
            </thead>
            <tbody>
              {pendingTasks.length === 0 && (
                <tr>
                  <td className="px-4 py-3 text-slate-400" colSpan={3}>
                    אין משימות פתוחות
                  </td>
                </tr>
              )}
              {pendingTasks.map((t) => (
                <tr key={t.id} className="border-t border-slate-100">
                  <td className="px-4 py-2">{t.title}</td>
                  <td className="px-4 py-2">{t.dueDate ?? "—"}</td>
                  <td className="px-4 py-2">{t.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium text-slate-900">פעילות אחרונה</h2>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <ul className="divide-y divide-slate-100 text-sm">
            {recentAudit.length === 0 && (
              <li className="px-4 py-3 text-slate-400">אין פעילות עדיין</li>
            )}
            {recentAudit.map((a) => (
              <li key={a.id} className="flex justify-between px-4 py-2">
                <span>
                  {a.employeeName ?? a.actorLabel ?? "מערכת"} — {a.action} ({a.entityType})
                </span>
                <span className="text-slate-400">{a.createdAt}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  href,
  tone,
}: {
  label: string;
  value: number;
  href: string;
  tone?: "danger";
}) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-slate-200 bg-white p-5 hover:border-slate-300"
    >
      <p className="text-sm text-slate-500">{label}</p>
      <p
        className={`mt-2 text-3xl font-semibold ${tone === "danger" && value > 0 ? "text-red-600" : "text-slate-900"}`}
      >
        {value}
      </p>
    </Link>
  );
}
