"use client";

import { createTaskAction } from "@/lib/actions/tasks";

export function NewTaskInlineForm({
  caseId,
  employees,
}: {
  caseId?: string;
  employees: Array<{ id: string; fullName: string }>;
}) {
  return (
    <form
      action={createTaskAction}
      className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-slate-300 p-3"
    >
      {caseId && <input type="hidden" name="caseId" value={caseId} />}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-500">כותרת משימה</label>
        <input name="title" required className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-500">תאריך יעד</label>
        <input type="date" name="dueDate" className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-500">אחראי</label>
        <select name="assignedToId" className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
          <option value="">— ללא —</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.fullName}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-500">עדיפות</label>
        <select name="priority" defaultValue="normal" className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
          <option value="low">נמוכה</option>
          <option value="normal">רגילה</option>
          <option value="high">גבוהה</option>
          <option value="urgent">דחוף</option>
        </select>
      </div>
      <button
        type="submit"
        className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-800"
      >
        הוספת משימה
      </button>
    </form>
  );
}
