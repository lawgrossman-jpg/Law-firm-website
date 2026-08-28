"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireSession } from "@/lib/auth/session";
import { buildCaseMergeData } from "@/lib/docgen/fieldMapper";
import { renderDocxTemplate } from "@/lib/docgen/templateEngine";
import { storeCaseFile } from "@/lib/documents/store";

export type DocumentFormState = { error?: string } | undefined;

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export async function generateDocumentAction(
  _prevState: DocumentFormState,
  formData: FormData,
): Promise<DocumentFormState> {
  const session = await requireSession();
  const caseId = String(formData.get("caseId") ?? "");
  const templateId = String(formData.get("templateId") ?? "");
  if (!caseId || !templateId) return { error: "יש לבחור תיק ותבנית מסמך" };

  const db = await getDb();
  const [caseRow] = await db.select().from(schema.cases).where(eq(schema.cases.id, caseId)).limit(1);
  const [template] = await db
    .select()
    .from(schema.documentTemplates)
    .where(eq(schema.documentTemplates.id, templateId))
    .limit(1);
  if (!caseRow || !template) return { error: "תיק או תבנית לא נמצאו" };

  let content: Uint8Array;
  try {
    const mergeData = await buildCaseMergeData(caseId);
    content = renderDocxTemplate(template.docxBase64, mergeData);
  } catch (err) {
    return { error: `שגיאה ביצירת המסמך: ${err instanceof Error ? err.message : String(err)}` };
  }

  const dateStamp = new Date().toISOString().slice(0, 10);
  const fileName = `${template.name} - ${caseRow.caseNumber} - ${dateStamp}.docx`;
  const relativePath = `${caseRow.folderPath}/מסמכים שנוצרו/${fileName}`;

  try {
    await storeCaseFile({
      caseId,
      relativePath,
      fileName,
      content,
      mimeType: DOCX_MIME,
      source: "generated",
      employeeId: session.employeeId,
    });
  } catch (err) {
    return {
      error: `המסמך נוצר אך העלאתו ל-SharePoint/Drive נכשלה (בדוק הגדרות סנכרון): ${
        err instanceof Error ? err.message : String(err)
      }`,
    };
  }

  redirect(`/cases/${caseId}`);
}

export async function uploadDocumentAction(
  _prevState: DocumentFormState,
  formData: FormData,
): Promise<DocumentFormState> {
  const session = await requireSession();
  const caseId = String(formData.get("caseId") ?? "");
  const file = formData.get("file");
  if (!caseId || !(file instanceof File) || file.size === 0) {
    return { error: "יש לבחור תיק וקובץ להעלאה" };
  }

  const db = await getDb();
  const [caseRow] = await db.select().from(schema.cases).where(eq(schema.cases.id, caseId)).limit(1);
  if (!caseRow) return { error: "תיק לא נמצא" };

  const relativePath = `${caseRow.folderPath}/${file.name}`;
  const content = new Uint8Array(await file.arrayBuffer());

  try {
    await storeCaseFile({
      caseId,
      relativePath,
      fileName: file.name,
      content,
      mimeType: file.type || "application/octet-stream",
      source: "manual_upload",
      employeeId: session.employeeId,
    });
  } catch (err) {
    return {
      error: `ההעלאה נכשלה: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  redirect(`/cases/${caseId}`);
}
