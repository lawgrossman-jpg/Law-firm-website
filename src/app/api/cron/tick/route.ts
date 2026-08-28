import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { ensureGraphSubscription, ensureDriveChannel } from "@/lib/sync/subscriptions";
import { processGraphChanges, processDriveChanges } from "@/lib/sync/engine";

/** Periodic maintenance tick: renews/creates the Graph + Drive webhook
 * subscriptions before they expire, and runs one polling pass of both
 * sync directions as a fallback in case a push notification was missed.
 *
 * This app's Next.js worker has no `scheduled` (Cron Trigger) handler of
 * its own — see cron-worker/ for a tiny companion Worker with a Cron
 * Trigger that simply fetches this route once an hour with the shared
 * secret header. An external scheduler (e.g. a GitHub Actions schedule or
 * cron-job.org) hitting this URL hourly works equally well. */
export async function POST(req: NextRequest) {
  const { env } = await getCloudflareContext({ async: true });

  const provided = req.headers.get("x-cron-secret");
  if (provided !== env.WEBHOOK_SHARED_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const results = await Promise.allSettled([
    ensureGraphSubscription(),
    ensureDriveChannel(),
    processGraphChanges(),
    processDriveChanges(),
  ]);

  return NextResponse.json({
    graphSubscription: settledStatus(results[0]),
    driveChannel: settledStatus(results[1]),
    graphPoll: settledResult(results[2]),
    drivePoll: settledResult(results[3]),
  });
}

function settledStatus(r: PromiseSettledResult<unknown>) {
  return r.status === "fulfilled" ? "ok" : String(r.reason);
}
function settledResult(r: PromiseSettledResult<unknown>) {
  return r.status === "fulfilled" ? r.value : String(r.reason);
}
