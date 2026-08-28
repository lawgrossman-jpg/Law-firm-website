import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";

const STATUS_LABELS: Record<string, string> = {
  open: "פתוח",
  on_hold: "מוקפא",
  closed: "סגור",
};

export default async function CasesPage() {
  const db = await getDb();
  const rows = await db
    .select({
      id: schema.cases.id,
      caseNumber: schema.cases.caseNumber,
      title: schema.cases.title,
      status: schema.cases.status,
      openedAt: schema.cases.openedAt,
      clientName: schema.clients.fullName,
    })
    .from(schema.cases)
    .leftJoin(schema.clients, eq(schema.cases.clientId, schema.clients.id))
    .orderBy(desc(schema.cases.createdAt));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">תיקים</h1>
        <Link
          href="/cases/new"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          תיק חדש
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-right text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">מס׳ תיק</th>
              <th className="px-4 py-2 font-medium">כותרת</th>
              <th className="px-4 py-2 font-medium">לקוח</th>
              <th className="px-4 py-2 font-medium">סטטוס</th>
              <th className="px-4 py-2 font-medium">תאריך פתיחה</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td className="px-4 py-3 text-slate-400" colSpan={5}>
                  אין תיקים עדיין
                </td>
              </tr>
            )}
            {rows.map((c) => (
              <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-2">
                  <Link href={`/cases/${c.id}`} className="text-slate-900 hover:underline">
                    {c.caseNumber}
                  </Link>
                </td>
                <td className="px-4 py-2">{c.title}</td>
                <td className="px-4 py-2">{c.clientName ?? "—"}</td>
                <td className="px-4 py-2">{STATUS_LABELS[c.status] ?? c.status}</td>
                <td className="px-4 py-2 text-slate-500">{c.openedAt?.slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
