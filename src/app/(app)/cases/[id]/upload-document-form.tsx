"use client";

import { useActionState } from "react";
import { uploadDocumentAction, type DocumentFormState } from "@/lib/actions/documents";

export function UploadDocumentForm({ caseId }: { caseId: string }) {
  const [state, formAction, pending] = useActionState<DocumentFormState, FormData>(
    uploadDocumentAction,
    undefined,
  );

  return (
    <form
      action={formAction}
      className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-slate-300 p-3"
    >
      <input type="hidden" name="caseId" value={caseId} />
      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-500">העלאת מסמך ידנית לתיקיית התיק</label>
        <input type="file" name="file" required className="text-sm" />
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-800 disabled:opacity-60"
      >
        {pending ? "מעלה..." : "העלאה"}
      </button>
    </form>
  );
}
