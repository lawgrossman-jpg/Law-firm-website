import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { ensureGraphSubscriptions, ensureDriveChannel } from "@/lib/sync/subscriptions";
import { processGraphChanges, processDriveChanges } from "@/lib/sync/engine";
import { discoverLibraries } from "@/lib/msgraph/libraries";

/** Periodic maintenance tick: discovers any SharePoint library created
 * since the last tick, renews/creates the Graph (one per library) + Drive
 * webhook subscriptions before they expire, and runs one polling pass of
 * both sync directions as a fallback in case a push notification was
 * missed.
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

  let discovery: { added: string[] } | { error: string };
  try {
    discovery = await discoverLibraries();
  } catch (err) {
    discovery = { error: err instanceof Error ? err.message : String(err) };
  }

  const results = await Promise.allSettled([
    ensureGraphSubscriptions(),
    ensureDriveChannel(),
    processGraphChanges(),
    processDriveChanges(),
  ]);

  return NextResponse.json({
    libraryDiscovery: discovery,
    graphSubscriptions: settledStatus(results[0]),
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
