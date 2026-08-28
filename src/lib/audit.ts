import "server-only";
import { getDb, schema } from "@/db";
import { newId } from "@/lib/id";
import type { AuditAction } from "@/db/schema";

type LogActionInput = {
  action: AuditAction;
  entityType: string;
  entityId?: string;
  employeeId?: string | null;
  /** Used when the action was performed by a cloud identity outside the
   * app (e.g. "עו״ד כהן (SharePoint)") rather than a logged-in employee. */
  actorLabel?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
};

/** Records one row in the audit_log table. Never throws to the caller —
 * logging failures must not block the underlying business action. */
export async function logAction(input: LogActionInput): Promise<void> {
  try {
    const db = await getDb();
    await db.insert(schema.auditLog).values({
      id: newId("audit"),
      employeeId: input.employeeId ?? null,
      actorLabel: input.actorLabel ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      details: input.details ?? null,
      ipAddress: input.ipAddress ?? null,
    });
  } catch (err) {
    console.error("audit log write failed", err);
  }
}
