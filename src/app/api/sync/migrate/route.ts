import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { requireRole, AuthError } from "@/lib/auth/session";
import { runInitialMigration } from "@/lib/sync/migration";
import { getDb, schema } from "@/db";

/** Kicks off the one-time full SharePoint -> Google Drive migration.
 *
 * From the browser (session auth), runs in the background (via
 * ctx.waitUntil) and returns immediately; progress is recorded as a
 * "sync.migration_run" row in the audit log once a run finishes (see
 * /admin/audit-log or /admin/sync's mapped-item count, which updates live
 * even mid-run). A large library can need several runs — each one resumes
 * where the last left off (see runInitialMigration's eTag-based skip) since
 * a single run may not finish within the Worker's CPU/time limit.
 *
 * Also accepts the same shared secret as /api/cron/tick (header
 * x-cron-secret), in which case it runs synchronously and returns the
 * actual MigrationResult — meant for scripted repeated calls to drive a
 * large backlog to completion without a human re-clicking the button each
 * time. */
export async function POST(req: NextRequest) {
  const provided = req.headers.get("x-cron-secret");
  const { env, ctx } = await getCloudflareContext({ async: true });

  if (provided && provided === env.WEBHOOK_SHARED_SECRET) {
    const db = await getDb();
    const [anyEmployee] = await db.select({ id: schema.employees.id }).from(schema.employees).limit(1);
    if (!anyEmployee) {
      return NextResponse.json({ error: "No employees in DB to attribute the run to" }, { status: 500 });
    }
    const result = await runInitialMigration(anyEmployee.id);
    return NextResponse.json(result);
  }

  let employeeId: string;
  try {
    const session = await requireRole("partner");
    employeeId = session.employeeId;
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    throw err;
  }

  ctx.waitUntil(
    runInitialMigration(employeeId).catch((err) => {
      console.error("Initial migration failed", err);
    }),
  );

  return NextResponse.json({ started: true });
}
