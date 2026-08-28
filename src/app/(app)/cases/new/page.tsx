import { getDb, schema } from "@/db";
import { CaseForm } from "./case-form";

export default async function NewCasePage() {
  const db = await getDb();
  const [clients, caseTypes, employees] = await Promise.all([
    db.select().from(schema.clients),
    db.select().from(schema.caseTypes),
    db.select().from(schema.employees),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-slate-900">תיק חדש</h1>
      <div className="max-w-2xl rounded-lg border border-slate-200 bg-white p-6">
        <CaseForm
          clients={clients.map((c) => ({ id: c.id, fullName: c.fullName }))}
          caseTypes={caseTypes.map((t) => ({ id: t.id, name: t.name }))}
          employees={employees
            .filter((e) => e.active)
            .map((e) => ({ id: e.id, fullName: e.fullName }))}
        />
      </div>
    </div>
  );
}
