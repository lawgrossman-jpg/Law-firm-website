"use client";

import { createMedicalRecordRequestAction } from "@/lib/actions/medicalRecordRequests";

export function NewMedicalRecordRequestInlineForm({
  caseId,
  employees,
}: {
  caseId: string;
  employees: Array<{ id: string; fullName: string }>;
}) {
  return (
    <form
      action={createMedicalRecordRequestAction}
      className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-slate-300 p-3"
    >
      <input type="hidden" name="caseId" value={caseId} />
      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-500">מקור (בית חולים/קופת חולים)</label>
        <input name="sourceName" required className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-500">תיאור</label>
        <input name="description" className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
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
      <button
        type="submit"
        className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-800"
      >
        הוספת בקשה
      </button>
    </form>
  );
}
