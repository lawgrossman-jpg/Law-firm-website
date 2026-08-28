import { desc, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireRole } from "@/lib/auth/session";
import { MigrateButton } from "./migrate-button";

export default async function SyncAdminPage() {
  await requireRole("partner");
  const db = await getDb();

  const [subscriptions, conflicts, [{ count: mappingCount }]] = await Promise.all([
    db.select().from(schema.webhookSubscriptions),
    db
      .select()
      .from(schema.syncConflicts)
      .orderBy(desc(schema.syncConflicts.createdAt))
      .limit(20),
    db.select({ count: sql<number>`count(*)` }).from(schema.syncMappings),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold text-slate-900">סנכרון SharePoint ↔ Google Drive</h1>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="mb-2 text-lg font-medium text-slate-900">הגירה חד-פעמית</h2>
        <p className="mb-4 text-sm text-slate-500">
          מעתיקה את כל עץ התיקיות והקבצים הקיים מ-SharePoint ל-Google Drive. פעולה זו
          אידמפוטנטית — ניתן להריץ שוב במקרה של כשל חלקי. לאחר ההרצה, שינויים בזמן אמת
          מתבצעים אוטומטית דרך ה-webhooks.
        </p>
        <MigrateButton />
        <p className="mt-3 text-xs text-slate-400">
          פריטים ממופים כרגע: {mappingCount}
        </p>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="mb-2 text-lg font-medium text-slate-900">מנויי Webhook</h2>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-right text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">ספק</th>
              <th className="px-3 py-2 font-medium">תוקף עד</th>
            </tr>
          </thead>
          <tbody>
            {subscriptions.length === 0 && (
              <tr>
                <td className="px-3 py-3 text-slate-400" colSpan={2}>
                  לא נוצרו עדיין מנויים — יווצרו אוטומטית בהרצת ה-cron הראשונה (ראו
                  cron-worker/ ב-README)
                </td>
              </tr>
            )}
            {subscriptions.map((s) => (
              <tr key={s.id} className="border-t border-slate-100">
                <td className="px-3 py-2">{s.provider === "graph" ? "SharePoint" : "Google Drive"}</td>
                <td className="px-3 py-2">{s.expirationDateTime}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="mb-2 text-lg font-medium text-slate-900">קונפליקטים אחרונים</h2>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-right text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">תיאור</th>
              <th className="px-3 py-2 font-medium">זמן</th>
            </tr>
          </thead>
          <tbody>
            {conflicts.length === 0 && (
              <tr>
                <td className="px-3 py-3 text-slate-400" colSpan={2}>
                  אין קונפליקטים
                </td>
              </tr>
            )}
            {conflicts.map((c) => (
              <tr key={c.id} className="border-t border-slate-100">
                <td className="px-3 py-2">{c.description}</td>
                <td className="px-3 py-2 text-slate-500">{c.createdAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
