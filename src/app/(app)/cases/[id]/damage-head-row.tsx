"use client";

import { updateDamageHeadAction, deleteDamageHeadAction } from "@/lib/actions/damageHeads";

export function DamageHeadRow({
  caseId,
  damageHead,
}: {
  caseId: string;
  damageHead: { id: string; label: string; estimatedAmount: number; proposedAmount: number | null };
}) {
  const formId = `damage-head-${damageHead.id}`;

  return (
    <tr className="border-t border-slate-100">
      <td className="px-2 py-1">
        <form id={formId} action={updateDamageHeadAction}>
          <input type="hidden" name="id" value={damageHead.id} />
          <input type="hidden" name="caseId" value={caseId} />
        </form>
        <input
          form={formId}
          name="label"
          defaultValue={damageHead.label}
          className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
        />
      </td>
      <td className="px-2 py-1">
        <input
          form={formId}
          name="estimatedAmount"
          type="number"
          step="0.01"
          defaultValue={damageHead.estimatedAmount}
          className="w-28 rounded-md border border-slate-300 px-2 py-1 text-sm"
        />
      </td>
      <td className="px-2 py-1">
        <input
          form={formId}
          name="proposedAmount"
          type="number"
          step="0.01"
          defaultValue={damageHead.proposedAmount ?? ""}
          className="w-28 rounded-md border border-slate-300 px-2 py-1 text-sm"
        />
      </td>
      <td className="whitespace-nowrap px-2 py-1">
        <button form={formId} type="submit" className="text-xs text-slate-600 underline hover:text-slate-900">
          שמירה
        </button>
        <form action={deleteDamageHeadAction} className="inline">
          <input type="hidden" name="id" value={damageHead.id} />
          <input type="hidden" name="caseId" value={caseId} />
          <button type="submit" className="mr-3 text-xs text-red-600 underline hover:text-red-800">
            מחיקה
          </button>
        </form>
      </td>
    </tr>
  );
}
