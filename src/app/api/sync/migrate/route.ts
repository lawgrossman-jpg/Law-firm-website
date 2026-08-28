import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { requireRole, AuthError } from "@/lib/auth/session";
import { runInitialMigration } from "@/lib/sync/migration";

/** Kicks off the one-time full SharePoint -> Google Drive migration in the
 * background (via ctx.waitUntil) and returns immediately; progress is
 * recorded as a "sync.migration_run" row in the audit log once it
 * finishes (see /admin/audit-log or /admin/sync). */
export async function POST() {
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

  const { ctx } = await getCloudflareContext({ async: true });
  ctx.waitUntil(
    runInitialMigration(employeeId).catch((err) => {
      console.error("Initial migration failed", err);
    }),
  );

  return NextResponse.json({ started: true });
}
