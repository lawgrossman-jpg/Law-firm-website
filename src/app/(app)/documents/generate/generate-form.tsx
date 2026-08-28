"use client";

import { useActionState } from "react";
import { generateDocumentAction, type DocumentFormState } from "@/lib/actions/documents";

export function GenerateDocumentForm({
  cases,
  templates,
  presetCaseId,
}: {
  cases: Array<{ id: string; label: string }>;
  templates: Array<{ id: string; name: string }>;
  presetCaseId?: string;
}) {
  const [state, formAction, pending] = useActionState<DocumentFormState, FormData>(
    generateDocumentAction,
    undefined,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-slate-700">תיק</span>
        <select
          name="caseId"
          required
          defaultValue={presetCaseId ?? ""}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="" disabled>
            — בחר תיק —
          </option>
          {cases.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-slate-700">סוג מסמך</span>
        <select
          name="templateId"
          required
          defaultValue=""
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="" disabled>
            — בחר תבנית —
          </option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
      >
        {pending ? "יוצר מסמך..." : "יצירת מסמך"}
      </button>
    </form>
  );
}
