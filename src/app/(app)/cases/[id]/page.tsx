import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, desc } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { updateCaseStatusAction } from "@/lib/actions/cases";
import { NewTaskInlineForm } from "@/app/(app)/tasks/new-task-inline-form";
import { TaskStatusSelect } from "@/app/(app)/tasks/task-status-select";
import { UploadDocumentForm } from "@/app/(app)/cases/[id]/upload-document-form";
import { MedicalRecordRequestStatusSelect } from "@/app/(app)/cases/[id]/medical-record-request-status-select";
import { NewMedicalRecordRequestInlineForm } from "@/app/(app)/cases/[id]/new-medical-record-request-inline-form";
import { DamageHeadRow } from "@/app/(app)/cases/[id]/damage-head-row";
import { createDamageHeadAction } from "@/lib/actions/damageHeads";

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

  const [client, parties, caseTasks, documents, employees, medicalRecordRequests, damageHeads] =
    await Promise.all([
      db.select().from(schema.clients).where(eq(schema.clients.id, caseRow.clientId)).limit(1),
      db.select().from(schema.caseParties).where(eq(schema.caseParties.caseId, id)),
      db.select().from(schema.tasks).where(eq(schema.tasks.caseId, id)).orderBy(schema.tasks.dueDate),
      db
        .select()
        .from(schema.documents)
        .where(eq(schema.documents.caseId, id))
        .orderBy(desc(schema.documents.createdAt)),
      db.select().from(schema.employees).where(eq(schema.employees.active, true)),
      db
        .select()
        .from(schema.medicalRecordRequests)
        .where(eq(schema.medicalRecordRequests.caseId, id))
        .orderBy(desc(schema.medicalRecordRequests.createdAt)),
      db
        .select()
        .from(schema.damageHeads)
        .where(eq(schema.damageHeads.caseId, id))
        .orderBy(schema.damageHeads.createdAt),
    ]);

  const estimatedTotal = damageHeads.reduce((sum, d) => sum + d.estimatedAmount, 0);
  const proposedTotal = damageHeads.reduce((sum, d) => sum + (d.proposedAmount ?? 0), 0);
  const damageDelta = estimatedTotal - proposedTotal;

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
        <h2 className="mb-3 text-lg font-medium text-slate-900">בקשות חומר רפואי</h2>
        <div className="mb-3 overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-right text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">מקור</th>
                <th className="px-4 py-2 font-medium">תיאור</th>
                <th className="px-4 py-2 font-medium">אחראי</th>
                <th className="px-4 py-2 font-medium">תזכורות</th>
                <th className="px-4 py-2 font-medium">סטטוס</th>
              </tr>
            </thead>
            <tbody>
              {medicalRecordRequests.length === 0 && (
                <tr>
                  <td className="px-4 py-3 text-slate-400" colSpan={5}>
                    אין בקשות חומר רפואי
                  </td>
                </tr>
              )}
              {medicalRecordRequests.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="px-4 py-2">{r.sourceName}</td>
                  <td className="px-4 py-2 text-slate-600">{r.description ?? "—"}</td>
                  <td className="px-4 py-2">
                    {employees.find((e) => e.id === r.assignedToId)?.fullName ?? "—"}
                  </td>
                  <td className="px-4 py-2">{r.remindersSentCount}</td>
                  <td className="px-4 py-2">
                    <MedicalRecordRequestStatusSelect
                      requestId={r.id}
                      caseId={caseRow.id}
                      status={r.status}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <NewMedicalRecordRequestInlineForm
          caseId={caseRow.id}
          employees={employees.map((e) => ({ id: e.id, fullName: e.fullName }))}
        />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium text-slate-900">ראשי נזק</h2>
        <div className="mb-3 overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-right text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">ראש נזק</th>
                <th className="px-4 py-2 font-medium">סכום משוער</th>
                <th className="px-4 py-2 font-medium">סכום מוצע/מוסכם</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {damageHeads.length === 0 && (
                <tr>
                  <td className="px-4 py-3 text-slate-400" colSpan={4}>
                    אין ראשי נזק
                  </td>
                </tr>
              )}
              {damageHeads.map((d) => (
                <DamageHeadRow key={d.id} caseId={caseRow.id} damageHead={d} />
              ))}
            </tbody>
            {damageHeads.length > 0 && (
              <tfoot>
                <tr className="border-t border-slate-200 bg-slate-50 font-medium">
                  <td className="px-4 py-2">סה״כ</td>
                  <td className="px-4 py-2">{estimatedTotal.toLocaleString("he-IL")}</td>
                  <td className="px-4 py-2">{proposedTotal.toLocaleString("he-IL")}</td>
                  <td className={`px-4 py-2 ${damageDelta >= 0 ? "text-red-700" : "text-green-700"}`}>
                    הפרש: {damageDelta.toLocaleString("he-IL")}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        <form
          action={createDamageHeadAction}
          className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-slate-300 p-3"
        >
          <input type="hidden" name="caseId" value={caseRow.id} />
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">ראש נזק</label>
            <input name="label" required className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">סכום משוער</label>
            <input
              name="estimatedAmount"
              type="number"
              step="0.01"
              className="w-32 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">סכום מוצע/מוסכם</label>
            <input
              name="proposedAmount"
              type="number"
              step="0.01"
              className="w-32 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-800"
          >
            הוספת ראש נזק
          </button>
        </form>
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
