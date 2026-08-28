import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { processGraphChanges } from "@/lib/sync/engine";

/** Microsoft Graph change-notification webhook. Graph first sends a
 * validation request with `?validationToken=...` that must be echoed back
 * as plain text within 10s; regular notifications carry `clientState`,
 * which must match our shared secret before we trust them. We don't
 * inspect the notification payload itself (Graph notifications carry no
 * useful diff) — we just use it as a trigger to run a delta-query pass. */
export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const validationToken = url.searchParams.get("validationToken");
  if (validationToken !== null) {
    return new NextResponse(validationToken, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  const { env, ctx } = await getCloudflareContext({ async: true });

  let body: { value?: Array<{ clientState?: string }> } = {};
  try {
    body = await req.json();
  } catch {
    // empty/invalid body — nothing to validate against, ignore silently
  }

  const notifications = body.value ?? [];
  const allValid = notifications.every(
    (n) => !n.clientState || n.clientState === env.WEBHOOK_SHARED_SECRET,
  );
  if (!allValid) {
    return NextResponse.json({ error: "invalid clientState" }, { status: 401 });
  }

  // Respond fast (Graph requires <10s); process the delta in the background.
  ctx.waitUntil(
    processGraphChanges().catch((err) => {
      console.error("processGraphChanges failed", err);
    }),
  );

  return new NextResponse(null, { status: 202 });
}
