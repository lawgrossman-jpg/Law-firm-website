import { desc, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireRole } from "@/lib/auth/session";
import { MigrateButton } from "./migrate-button";
import { DiscoverLibrariesButton } from "./discover-libraries-button";
import { setLibraryEnabledAction, setPrimaryLibraryAction } from "@/lib/actions/libraries";

export default async function SyncAdminPage() {
  await requireRole("partner");
  const db = await getDb();

  const [libraries, subscriptions, conflicts, [{ count: mappingCount }]] = await Promise.all([
    db.select().from(schema.sharepointLibraries).orderBy(schema.sharepointLibraries.name),
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
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-medium text-slate-900">ספריות מסמכים (SharePoint)</h2>
          <DiscoverLibrariesButton />
        </div>
        <p className="mb-4 text-sm text-slate-500">
          כל הספריות באתר ה-SharePoint של המשרד. ספרייה מסומנת כ״פעילה״ מסונכרנת (הגירה +
          זמן אמת) לתיקייה מקבילה ב-Google Drive. ספרייה אחת מסומנת כ״ראשית לתיקים״ —
          תיקים חדשים שנוצרים באתר נוצרים בתוכה. ספריות חדשות שנוספות בעתיד ל-SharePoint
          מתגלות אוטומטית בכל הרצת cron שעתית (או בלחיצה על הכפתור).
        </p>
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-right text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">שם</th>
                <th className="px-3 py-2 font-medium">פעילה</th>
                <th className="px-3 py-2 font-medium">ראשית לתיקים</th>
              </tr>
            </thead>
            <tbody>
              {libraries.length === 0 && (
                <tr>
                  <td className="px-3 py-3 text-slate-400" colSpan={3}>
                    אין עדיין ספריות מוגדרות — לחצו ״גילוי ספריות״ למעלה.
                  </td>
                </tr>
              )}
              {libraries.map((lib) => (
                <tr key={lib.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">{lib.name}</td>
                  <td className="px-3 py-2">
                    <form action={setLibraryEnabledAction}>
                      <input type="hidden" name="libraryId" value={lib.id} />
                      <input type="hidden" name="enabled" value={(!lib.enabled).toString()} />
                      <button
                        type="submit"
                        className={`rounded-md px-2 py-1 text-xs ${lib.enabled ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-500"}`}
                      >
                        {lib.enabled ? "פעילה — כבה" : "כבויה — הפעל"}
                      </button>
                    </form>
                  </td>
                  <td className="px-3 py-2">
                    {lib.isPrimaryForCases ? (
                      <span className="rounded-md bg-slate-900 px-2 py-1 text-xs text-white">ראשית</span>
                    ) : (
                      <form action={setPrimaryLibraryAction}>
                        <input type="hidden" name="libraryId" value={lib.id} />
                        <button type="submit" className="text-xs text-slate-500 underline hover:text-slate-800">
                          הפוך לראשית
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="mb-2 text-lg font-medium text-slate-900">הגירה חד-פעמית</h2>
        <p className="mb-4 text-sm text-slate-500">
          מעתיקה את כל עץ התיקיות והקבצים הקיים מכל הספריות הפעילות ל-Google Drive (כל
          ספרייה כתיקייה נפרדת בשורש). פעולה זו אידמפוטנטית — ניתן להריץ שוב במקרה של כשל
          חלקי. לאחר ההרצה, שינויים בזמן אמת מתבצעים אוטומטית דרך ה-webhooks.
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
              <th className="px-3 py-2 font-medium">ספרייה</th>
              <th className="px-3 py-2 font-medium">תוקף עד</th>
            </tr>
          </thead>
          <tbody>
            {subscriptions.length === 0 && (
              <tr>
                <td className="px-3 py-3 text-slate-400" colSpan={3}>
                  לא נוצרו עדיין מנויים — יווצרו אוטומטית בהרצת ה-cron הראשונה (ראו
                  cron-worker/ ב-README)
                </td>
              </tr>
            )}
            {subscriptions.map((s) => (
              <tr key={s.id} className="border-t border-slate-100">
                <td className="px-3 py-2">{s.provider === "graph" ? "SharePoint" : "Google Drive"}</td>
                <td className="px-3 py-2 text-slate-500">
                  {libraries.find((l) => l.driveId === s.sharepointDriveId)?.name ?? "—"}
                </td>
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
