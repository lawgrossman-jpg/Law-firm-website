import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { processDriveChanges } from "@/lib/sync/engine";

/** Google Drive push-notification webhook. Google sends headers, not a
 * body: X-Goog-Channel-Token (our shared secret, set at watch time),
 * X-Goog-Resource-State ("sync" on channel creation, "change" afterwards).
 * We don't inspect the payload — every notification is just a trigger to
 * run a changes.list pass from our stored page token. */
export async function POST(req: NextRequest) {
  const { env, ctx } = await getCloudflareContext({ async: true });

  const token = req.headers.get("x-goog-channel-token");
  if (token !== env.WEBHOOK_SHARED_SECRET) {
    return NextResponse.json({ error: "invalid channel token" }, { status: 401 });
  }

  const resourceState = req.headers.get("x-goog-resource-state");
  if (resourceState === "sync") {
    // Initial channel-creation ping — nothing changed yet.
    return new NextResponse(null, { status: 200 });
  }

  ctx.waitUntil(
    processDriveChanges().catch((err) => {
      console.error("processDriveChanges failed", err);
    }),
  );

  return new NextResponse(null, { status: 200 });
}
