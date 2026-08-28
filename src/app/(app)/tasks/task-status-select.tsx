"use client";

import { updateTaskStatusAction } from "@/lib/actions/tasks";

const STATUS_LABELS: Record<string, string> = {
  pending: "ממתין",
  in_progress: "בביצוע",
  done: "הושלם",
  cancelled: "בוטל",
};

export function TaskStatusSelect({
  taskId,
  caseId,
  status,
}: {
  taskId: string;
  caseId?: string | null;
  status: string;
}) {
  return (
    <form action={updateTaskStatusAction} className="flex items-center gap-2">
      <input type="hidden" name="taskId" value={taskId} />
      {caseId && <input type="hidden" name="caseId" value={caseId} />}
      <select
        name="status"
        defaultValue={status}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="rounded-md border border-slate-300 px-2 py-1 text-xs"
      >
        {Object.entries(STATUS_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </form>
  );
}
