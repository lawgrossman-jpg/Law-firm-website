import { NextResponse } from "next/server";
import { requireRole, AuthError } from "@/lib/auth/session";
import { discoverLibraries } from "@/lib/msgraph/libraries";

/** Manual trigger for library auto-discovery (also runs automatically on
 * every hourly cron tick — see /api/cron/tick). */
export async function POST() {
  try {
    await requireRole("partner");
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }

  try {
    const result = await discoverLibraries();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
