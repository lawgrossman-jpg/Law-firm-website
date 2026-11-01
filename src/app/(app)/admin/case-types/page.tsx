import { desc } from "drizzle-orm";
import Link from "next/link";
import { getDb, schema } from "@/db";

export default async function CaseTypesPage() {
  const db = await getDb();
  const caseTypes = await db
    .select()
    .from(schema.caseTypes)
    .orderBy(desc(schema.caseTypes.createdAt));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">סוגי תיקים</h1>
        <Link
          href="/admin/case-types/new"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          סוג תיק חדש
        </Link>
      </div>

      <section className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-right text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">שם</th>
              <th className="px-4 py-2 font-medium">תיאור</th>
              <th className="px-4 py-2 font-medium">תיקיות</th>
              <th className="px-4 py-2 font-medium">משימות אוטומטיות</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {caseTypes.map((ct) => (
              <tr key={ct.id} className="border-t border-slate-100">
                <td className="px-4 py-2 font-medium text-slate-900">{ct.name}</td>
                <td className="px-4 py-2 text-slate-600">{ct.description}</td>
                <td className="px-4 py-2 text-slate-600">{ct.folderTemplate.length}</td>
                <td className="px-4 py-2 text-slate-600">{ct.taskTemplate.length}</td>
                <td className="px-4 py-2">
                  <Link
                    href={`/admin/case-types/${ct.id}/edit`}
                    className="text-xs text-slate-500 underline hover:text-slate-800"
                  >
                    עריכה
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
