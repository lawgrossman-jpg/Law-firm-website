import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireRole } from "@/lib/auth/session";

export default async function AuditLogPage() {
  await requireRole("partner");
  const db = await getDb();
  const rows = await db
    .select({
      id: schema.auditLog.id,
      action: schema.auditLog.action,
      entityType: schema.auditLog.entityType,
      entityId: schema.auditLog.entityId,
      actorLabel: schema.auditLog.actorLabel,
      details: schema.auditLog.details,
      createdAt: schema.auditLog.createdAt,
      employeeName: schema.employees.fullName,
    })
    .from(schema.auditLog)
    .leftJoin(schema.employees, eq(schema.auditLog.employeeId, schema.employees.id))
    .orderBy(desc(schema.auditLog.createdAt))
    .limit(200);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-slate-900">יומן אירועים (Audit Log)</h1>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-right text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">זמן</th>
              <th className="px-4 py-2 font-medium">מבצע</th>
              <th className="px-4 py-2 font-medium">פעולה</th>
              <th className="px-4 py-2 font-medium">ישות</th>
              <th className="px-4 py-2 font-medium">פרטים</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-100 align-top">
                <td className="whitespace-nowrap px-4 py-2 text-slate-500">{r.createdAt}</td>
                <td className="px-4 py-2">{r.employeeName ?? r.actorLabel ?? "מערכת"}</td>
                <td className="px-4 py-2">{r.action}</td>
                <td className="px-4 py-2">
                  {r.entityType}
                  {r.entityId ? ` #${r.entityId.slice(0, 8)}` : ""}
                </td>
                <td className="max-w-xs truncate px-4 py-2 text-slate-500">
                  {r.details ? JSON.stringify(r.details) : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
