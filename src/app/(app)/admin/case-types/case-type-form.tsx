"use client";

import { useActionState, useState, type ReactNode } from "react";
import {
  createCaseTypeAction,
  updateCaseTypeAction,
  type CaseTypeFormState,
} from "@/lib/actions/caseTypes";
import type { EmployeeRole } from "@/db/schema";

const ASSIGNEE_ROLES: Array<{ value: EmployeeRole; label: string }> = [
  { value: "partner", label: "שותף" },
  { value: "associate", label: "עו״ד שכיר" },
  { value: "intern", label: "מתמחה" },
  { value: "secretary", label: "מזכירות" },
];

type TaskTemplateRow = {
  taskTitle: string;
  taskDescription: string;
  taskDueOffsetDays: string;
  taskAssigneeRole: string;
};

const EMPTY_ROW: TaskTemplateRow = {
  taskTitle: "",
  taskDescription: "",
  taskDueOffsetDays: "1",
  taskAssigneeRole: "associate",
};

export function CaseTypeForm({
  caseType,
}: {
  caseType?: {
    id: string;
    name: string;
    description: string | null;
    folderTemplate: string[];
    taskTemplate: Array<{
      title: string;
      description?: string;
      dueOffsetDays: number;
      assigneeRole?: EmployeeRole;
    }>;
  };
}) {
  const [state, formAction, pending] = useActionState<CaseTypeFormState, FormData>(
    caseType ? updateCaseTypeAction : createCaseTypeAction,
    undefined,
  );

  const [rows, setRows] = useState<TaskTemplateRow[]>(
    caseType && caseType.taskTemplate.length > 0
      ? caseType.taskTemplate.map((t) => ({
          taskTitle: t.title,
          taskDescription: t.description ?? "",
          taskDueOffsetDays: String(t.dueOffsetDays),
          taskAssigneeRole: t.assigneeRole ?? "associate",
        }))
      : [EMPTY_ROW],
  );

  function updateRow(index: number, patch: Partial<TaskTemplateRow>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {caseType && <input type="hidden" name="id" value={caseType.id} />}

      <Field label="שם סוג התיק">
        <input name="name" required defaultValue={caseType?.name} className="input" />
      </Field>

      <Field label="תיאור">
        <input name="description" defaultValue={caseType?.description ?? ""} className="input" />
      </Field>

      <Field label="תבנית תיקיות (שורה לכל תיקייה)">
        <textarea
          name="folderTemplate"
          rows={6}
          defaultValue={caseType?.folderTemplate.join("\n") ?? ""}
          className="input"
        />
      </Field>

      <fieldset className="rounded-md border border-slate-200 p-3">
        <legend className="px-1 text-sm font-medium text-slate-700">
          משימות אוטומטיות בפתיחת תיק
        </legend>
        <div className="flex flex-col gap-3">
          {rows.map((row, i) => (
            <div
              key={i}
              className="grid grid-cols-1 gap-2 border-b border-slate-100 pb-3 last:border-0 sm:grid-cols-5"
            >
              <input
                name="taskTitle"
                placeholder="כותרת המשימה"
                value={row.taskTitle}
                onChange={(e) => updateRow(i, { taskTitle: e.target.value })}
                className="input sm:col-span-2"
              />
              <input
                name="taskDescription"
                placeholder="תיאור (אופציונלי)"
                value={row.taskDescription}
                onChange={(e) => updateRow(i, { taskDescription: e.target.value })}
                className="input"
              />
              <input
                name="taskDueOffsetDays"
                type="number"
                min={0}
                placeholder="ימים ממועד פתיחה"
                value={row.taskDueOffsetDays}
                onChange={(e) => updateRow(i, { taskDueOffsetDays: e.target.value })}
                className="input"
              />
              <div className="flex gap-1">
                <select
                  name="taskAssigneeRole"
                  value={row.taskAssigneeRole}
                  onChange={(e) => updateRow(i, { taskAssigneeRole: e.target.value })}
                  className="input"
                >
                  {ASSIGNEE_ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))}
                  disabled={rows.length === 1}
                  className="rounded-md border border-slate-300 px-2 text-sm text-slate-500 hover:bg-slate-100 disabled:opacity-40"
                >
                  הסרה
                </button>
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setRows((prev) => [...prev, EMPTY_ROW])}
          className="mt-3 rounded-md bg-slate-100 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-200"
        >
          + הוספת משימה
        </button>
      </fieldset>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 w-fit rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
      >
        {pending ? "שומר..." : caseType ? "שמירת שינויים" : "יצירת סוג תיק"}
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
