"use client";

import { useActionState } from "react";
import { createEmployeeAction, type EmployeeFormState } from "@/lib/actions/employees";

const ROLES: Array<{ value: string; label: string }> = [
  { value: "partner", label: "שותף" },
  { value: "associate", label: "עו״ד שכיר" },
  { value: "intern", label: "מתמחה" },
  { value: "secretary", label: "מזכירות" },
  { value: "admin", label: "מנהל מערכת" },
];

export function EmployeeForm() {
  const [state, formAction, pending] = useActionState<EmployeeFormState, FormData>(
    createEmployeeAction,
    undefined,
  );

  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
      <input
        name="fullName"
        placeholder="שם מלא"
        required
        className="rounded-md border border-slate-300 px-3 py-2 text-sm"
      />
      <input
        name="email"
        type="email"
        placeholder="אימייל"
        required
        className="rounded-md border border-slate-300 px-3 py-2 text-sm"
      />
      <input
        name="password"
        type="password"
        placeholder="סיסמה זמנית"
        required
        className="rounded-md border border-slate-300 px-3 py-2 text-sm"
      />
      <select
        name="role"
        defaultValue="associate"
        className="rounded-md border border-slate-300 px-3 py-2 text-sm"
      >
        {ROLES.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </select>
      {state?.error && (
        <p className="col-span-full text-sm text-red-600">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="col-span-full w-fit rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
      >
        {pending ? "מוסיף..." : "הוספת עובד"}
      </button>
    </form>
  );
}
