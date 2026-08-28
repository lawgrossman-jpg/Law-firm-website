import { desc } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { EmployeeForm } from "./employee-form";
import { setEmployeeActiveAction } from "@/lib/actions/employees";
import { setEmployeeIdentityMappingAction } from "@/lib/actions/identity";

const ROLE_LABELS: Record<string, string> = {
  partner: "שותף",
  associate: "עו״ד שכיר",
  intern: "מתמחה",
  secretary: "מזכירות",
  admin: "מנהל מערכת",
};

export default async function EmployeesPage() {
  const db = await getDb();
  const [employees, identityRows] = await Promise.all([
    db.select().from(schema.employees).orderBy(desc(schema.employees.createdAt)),
    db.select().from(schema.userIdentityMap),
  ]);
  const identityByEmployee = new Map(identityRows.map((r) => [r.employeeId, r]));

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold text-slate-900">עובדים והרשאות</h1>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-lg font-medium text-slate-900">הוספת עובד</h2>
        <EmployeeForm />
      </section>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-right text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">שם מלא</th>
              <th className="px-4 py-2 font-medium">אימייל</th>
              <th className="px-4 py-2 font-medium">תפקיד</th>
              <th className="px-4 py-2 font-medium">סטטוס</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {employees.map((e) => (
              <tr key={e.id} className="border-t border-slate-100">
                <td className="px-4 py-2">{e.fullName}</td>
                <td className="px-4 py-2">{e.email}</td>
                <td className="px-4 py-2">{ROLE_LABELS[e.role] ?? e.role}</td>
                <td className="px-4 py-2">{e.active ? "פעיל" : "מושבת"}</td>
                <td className="px-4 py-2">
                  <form action={setEmployeeActiveAction}>
                    <input type="hidden" name="employeeId" value={e.id} />
                    <input type="hidden" name="active" value={(!e.active).toString()} />
                    <button
                      type="submit"
                      className="text-xs text-slate-500 underline hover:text-slate-800"
                    >
                      {e.active ? "השבתה" : "הפעלה"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="mb-1 text-lg font-medium text-slate-900">מיפוי זהויות לסנכרון</h2>
        <p className="mb-4 text-sm text-slate-500">
          קישור בין חשבון Microsoft 365 לחשבון Google Workspace של כל עובד, כדי שעריכת
          מסמך תיוחס נכון בשני הצדדים (יומן אירועים + קרדיט ב-Drive).
        </p>
        <div className="flex flex-col gap-3">
          {employees.map((e) => {
            const mapping = identityByEmployee.get(e.id);
            return (
              <form
                key={e.id}
                action={setEmployeeIdentityMappingAction}
                className="grid grid-cols-1 items-end gap-2 border-b border-slate-100 pb-3 last:border-0 sm:grid-cols-4"
              >
                <input type="hidden" name="employeeId" value={e.id} />
                <div className="text-sm text-slate-700">{e.fullName}</div>
                <input
                  name="msUserPrincipalName"
                  placeholder="אימייל Microsoft 365"
                  defaultValue={mapping?.msUserPrincipalName ?? ""}
                  className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                />
                <input
                  name="googleEmail"
                  placeholder="אימייל Google Workspace"
                  defaultValue={mapping?.googleEmail ?? ""}
                  className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                />
                <button
                  type="submit"
                  className="rounded-md bg-slate-100 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-200"
                >
                  שמירה
                </button>
              </form>
            );
          })}
        </div>
      </section>
    </div>
  );
}
