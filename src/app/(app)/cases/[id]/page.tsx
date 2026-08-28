import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, desc } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { updateCaseStatusAction } from "@/lib/actions/cases";
import { NewTaskInlineForm } from "@/app/(app)/tasks/new-task-inline-form";
import { TaskStatusSelect } from "@/app/(app)/tasks/task-status-select";
import { UploadDocumentForm } from "@/app/(app)/cases/[id]/upload-document-form";

const PARTY_ROLE_LABELS: Record<string, string> = {
  plaintiff: "תובע",
  defendant: "נתבע",
  client: "לקוח",
  opposing_counsel: "ב״כ הצד שכנגד",
  other: "אחר",
};

export default async function CaseDetailPage({
  params,
  searchParams,
}: PageProps<"/cases/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const provisionError = typeof sp.provisionError === "string" ? sp.provisionError : undefined;

  const db = await getDb();
  const [caseRow] = await db.select().from(schema.cases).where(eq(schema.cases.id, id)).limit(1);
  if (!caseRow) notFound();

  const [client, parties, caseTasks, documents, employees] = await Promise.all([
    db.select().from(schema.clients).where(eq(schema.clients.id, caseRow.clientId)).limit(1),
    db.select().from(schema.caseParties).where(eq(schema.caseParties.caseId, id)),
    db.select().from(schema.tasks).where(eq(schema.tasks.caseId, id)).orderBy(schema.tasks.dueDate),
    db
      .select()
      .from(schema.documents)
      .where(eq(schema.documents.caseId, id))
      .orderBy(desc(schema.documents.createdAt)),
    db.select().from(schema.employees).where(eq(schema.employees.active, true)),
  ]);

  return (
    <div className="flex flex-col gap-8">
      {provisionError && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          התיק נוצר, אך יצירת התיקיות ב-SharePoint/Drive נכשלה (בדוק את הגדרות
          האינטגרציה תחת סנכרון): {provisionError}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm text-slate-500">{caseRow.caseNumber}</p>
          <h1 className="text-2xl font-semibold text-slate-900">{caseRow.title}</h1>
          <p className="mt-1 text-sm text-slate-500">
            לקוח: {client[0]?.fullName ?? "—"} · נתיב תיקייה: {caseRow.folderPath}
          </p>
        </div>
        <form action={updateCaseStatusAction} className="flex items-center gap-2">
          <input type="hidden" name="caseId" value={caseRow.id} />
          <select
            name="status"
            defaultValue={caseRow.status}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          >
            <option value="open">פתוח</option>
            <option value="on_hold">מוקפא</option>
            <option value="closed">סגור</option>
          </select>
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-800"
          >
            עדכון סטטוס
          </button>
        </form>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-medium text-slate-900">צדדים בתיק</h2>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-right text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">תפקיד</th>
                <th className="px-4 py-2 font-medium">שם</th>
                <th className="px-4 py-2 font-medium">ת״ז</th>
                <th className="px-4 py-2 font-medium">טלפון</th>
              </tr>
            </thead>
            <tbody>
              {parties.map((p) => (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="px-4 py-2">{PARTY_ROLE_LABELS[p.role] ?? p.role}</td>
                  <td className="px-4 py-2">{p.fullName}</td>
                  <td className="px-4 py-2">{p.idNumber ?? "—"}</td>
                  <td className="px-4 py-2">{p.phone ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-medium text-slate-900">משימות</h2>
          <Link href={`/documents/generate?caseId=${caseRow.id}`} className="text-sm text-slate-600 underline">
            יצירת מסמך לתיק זה
          </Link>
        </div>
        <div className="mb-3 overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-right text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">כותרת</th>
                <th className="px-4 py-2 font-medium">אחראי</th>
                <th className="px-4 py-2 font-medium">תאריך יעד</th>
                <th className="px-4 py-2 font-medium">סטטוס</th>
              </tr>
            </thead>
            <tbody>
              {caseTasks.length === 0 && (
                <tr>
                  <td className="px-4 py-3 text-slate-400" colSpan={4}>
                    אין משימות
                  </td>
                </tr>
              )}
              {caseTasks.map((t) => (
                <tr key={t.id} className="border-t border-slate-100">
                  <td className="px-4 py-2">{t.title}</td>
                  <td className="px-4 py-2">
                    {employees.find((e) => e.id === t.assignedToId)?.fullName ?? "—"}
                  </td>
                  <td className="px-4 py-2">{t.dueDate ?? "—"}</td>
                  <td className="px-4 py-2">
                    <TaskStatusSelect taskId={t.id} caseId={caseRow.id} status={t.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <NewTaskInlineForm caseId={caseRow.id} employees={employees.map((e) => ({ id: e.id, fullName: e.fullName }))} />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium text-slate-900">מסמכים</h2>
        <div className="mb-3 overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-right text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">שם</th>
                <th className="px-4 py-2 font-medium">נתיב</th>
                <th className="px-4 py-2 font-medium">מקור</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {documents.length === 0 && (
                <tr>
                  <td className="px-4 py-3 text-slate-400" colSpan={4}>
                    אין מסמכים
                  </td>
                </tr>
              )}
              {documents.map((d) => (
                <tr key={d.id} className="border-t border-slate-100">
                  <td className="px-4 py-2">{d.name}</td>
                  <td className="px-4 py-2 text-slate-500">{d.relativePath}</td>
                  <td className="px-4 py-2">{d.source}</td>
                  <td className="px-4 py-2">
                    <a
                      href={`/api/files/${d.id}/view`}
                      target="_blank"
                      className="ml-3 text-xs text-slate-600 underline"
                    >
                      צפייה
                    </a>
                    <a href={`/api/files/${d.id}/download`} className="text-xs text-slate-600 underline">
                      הורדה
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <UploadDocumentForm caseId={caseRow.id} />
      </section>
    </div>
  );
}
