"use client";

import { useActionState, useState, type ReactNode } from "react";
import { createCaseAction, type CaseFormState } from "@/lib/actions/cases";

export function CaseForm({
  clients,
  caseTypes,
  employees,
}: {
  clients: Array<{ id: string; fullName: string }>;
  caseTypes: Array<{ id: string; name: string }>;
  employees: Array<{ id: string; fullName: string }>;
}) {
  const [state, formAction, pending] = useActionState<CaseFormState, FormData>(
    createCaseAction,
    undefined,
  );
  const [clientMode, setClientMode] = useState<"existing" | "new">(
    clients.length > 0 ? "existing" : "new",
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field label="כותרת התיק">
        <input name="title" required className="input" />
      </Field>

      <Field label="סוג תיק">
        <select name="caseTypeId" className="input">
          <option value="">— בחר סוג תיק —</option>
          {caseTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </Field>

      <fieldset className="rounded-md border border-slate-200 p-3">
        <legend className="px-1 text-sm font-medium text-slate-700">לקוח</legend>
        <div className="mb-3 flex gap-4 text-sm">
          <label className="flex items-center gap-1">
            <input
              type="radio"
              checked={clientMode === "existing"}
              onChange={() => setClientMode("existing")}
              disabled={clients.length === 0}
            />
            לקוח קיים
          </label>
          <label className="flex items-center gap-1">
            <input
              type="radio"
              checked={clientMode === "new"}
              onChange={() => setClientMode("new")}
            />
            לקוח חדש
          </label>
        </div>

        {clientMode === "existing" ? (
          <select name="clientId" className="input">
            <option value="">— בחר לקוח —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.fullName}
              </option>
            ))}
          </select>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input name="newClientName" placeholder="שם מלא" className="input" />
            <input name="newClientIdNumber" placeholder="ת״ז" className="input" />
            <input name="newClientPhone" placeholder="טלפון" className="input" />
            <input name="newClientEmail" placeholder="אימייל" className="input" />
          </div>
        )}
      </fieldset>

      <Field label="הצד שכנגד">
        <input name="opposingParty" className="input" />
      </Field>

      <Field label='מס׳ הליך בבית המשפט'>
        <input name="courtCaseNumber" className="input" />
      </Field>

      <Field label="עו״ד אחראי">
        <select name="responsibleEmployeeId" className="input">
          <option value="">— ללא —</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.fullName}
            </option>
          ))}
        </select>
      </Field>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 w-fit rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
      >
        {pending ? "יוצר תיק..." : "יצירת תיק"}
      </button>

      <style jsx global>{`
        .input {
          border: 1px solid #cbd5e1;
          border-radius: 0.375rem;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          width: 100%;
        }
        .input:focus {
          outline: none;
          border-color: #64748b;
        }
      `}</style>
    </form>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}
