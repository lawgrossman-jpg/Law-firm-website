"use client";

import { updateMedicalRecordRequestStatusAction } from "@/lib/actions/medicalRecordRequests";
import type { MedicalRecordRequestStatus } from "@/db/schema";

const STATUS_LABELS: Record<MedicalRecordRequestStatus, string> = {
  requested: "הוזמן",
  reminder_sent: "תזכורת נשלחה",
  received: "התקבל",
  sent_to_expert: "נשלח למומחה",
  cancelled: "בוטל",
};

export function MedicalRecordRequestStatusSelect({
  requestId,
  caseId,
  status,
}: {
  requestId: string;
  caseId: string;
  status: MedicalRecordRequestStatus;
}) {
  return (
    <form action={updateMedicalRecordRequestStatusAction} className="flex items-center gap-2">
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="caseId" value={caseId} />
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
