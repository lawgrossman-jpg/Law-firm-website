import { desc } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { GenerateDocumentForm } from "./generate-form";

export default async function GenerateDocumentPage({
  searchParams,
}: PageProps<"/documents/generate">) {
  const sp = await searchParams;
  const presetCaseId = typeof sp.caseId === "string" ? sp.caseId : undefined;

  const db = await getDb();
  const [cases, templates] = await Promise.all([
    db.select().from(schema.cases).orderBy(desc(schema.cases.createdAt)),
    db.select().from(schema.documentTemplates),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-slate-900">מחולל מסמכים</h1>
      <p className="text-sm text-slate-500">
        יצירת מסמך משפטי (יפוי כוח, כתב תביעה) עם מילוי אוטומטי של שדות מתוך רשומת התיק.
      </p>
      <div className="max-w-xl rounded-lg border border-slate-200 bg-white p-6">
        {templates.length === 0 ? (
          <p className="text-sm text-amber-700">
            אין תבניות מסמכים במערכת. הריצו <code>npm run templates:generate</code> ואת
            סקריפט הזריעה (db:seed) כדי להטעין את תבניות ברירת המחדל.
          </p>
        ) : (
          <GenerateDocumentForm
            cases={cases.map((c) => ({ id: c.id, label: `${c.caseNumber} — ${c.title}` }))}
            templates={templates.map((t) => ({ id: t.id, name: t.name }))}
            presetCaseId={presetCaseId}
          />
        )}
      </div>
    </div>
  );
}
