import "server-only";
import { eq } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb, schema } from "@/db";
import { newId } from "@/lib/id";
import * as graph from "@/lib/msgraph/client";
import * as drive from "@/lib/googledrive/client";

const GRAPH_SUBSCRIPTION_LIFETIME_MS = 60 * 60 * 1000 * 60; // ~2.5 days (Graph max for driveItem is ~3 days)
const DRIVE_CHANNEL_LIFETIME_MS = 1000 * 60 * 60 * 23; // 23h (Drive max is ~24h unless a longer grant applies)
const RENEW_WINDOW_MS = 1000 * 60 * 60 * 6; // renew if expiring within 6h

/** Ensures an active Microsoft Graph change-notification subscription
 * exists for the document library, creating or renewing it as needed.
 * Call this from the hourly cron tick (see /api/cron/tick). */
export async function ensureGraphSubscription(): Promise<void> {
  const db = await getDb();
  const { env } = await getCloudflareContext({ async: true });
  const notificationUrl = `${env.APP_BASE_URL}/api/webhooks/sharepoint`;

  const [existing] = await db
    .select()
    .from(schema.webhookSubscriptions)
    .where(eq(schema.webhookSubscriptions.provider, "graph"))
    .limit(1);

  const expiresAt = existing ? new Date(existing.expirationDateTime).getTime() : 0;
  if (existing && expiresAt - Date.now() > RENEW_WINDOW_MS) return; // still fresh

  const newExpiration = new Date(Date.now() + GRAPH_SUBSCRIPTION_LIFETIME_MS).toISOString();

  if (existing) {
    try {
      await graph.renewSubscription(existing.subscriptionId, newExpiration);
      await db
        .update(schema.webhookSubscriptions)
        .set({ expirationDateTime: newExpiration })
        .where(eq(schema.webhookSubscriptions.id, existing.id));
      return;
    } catch {
      // Subscription may have already expired/been deleted server-side; fall through to recreate.
    }
  }

  const created = await graph.createSubscription({
    notificationUrl,
    clientState: env.WEBHOOK_SHARED_SECRET,
    expirationDateTime: newExpiration,
  });

  if (existing) {
    await db
      .update(schema.webhookSubscriptions)
      .set({ subscriptionId: created.id, expirationDateTime: created.expirationDateTime })
      .where(eq(schema.webhookSubscriptions.id, existing.id));
  } else {
    await db.insert(schema.webhookSubscriptions).values({
      id: newId("wh"),
      provider: "graph",
      subscriptionId: created.id,
      resourceUri: notificationUrl,
      expirationDateTime: created.expirationDateTime,
    });
  }
}

/** Ensures an active Google Drive push-notification channel exists,
 * re-creating it as needed (Drive channels can't be renewed in place). */
export async function ensureDriveChannel(): Promise<void> {
  const db = await getDb();
  const { env } = await getCloudflareContext({ async: true });
  const webhookUrl = `${env.APP_BASE_URL}/api/webhooks/drive`;

  const [existing] = await db
    .select()
    .from(schema.webhookSubscriptions)
    .where(eq(schema.webhookSubscriptions.provider, "drive"))
    .limit(1);

  const expiresAt = existing ? new Date(existing.expirationDateTime).getTime() : 0;
  if (existing && expiresAt - Date.now() > RENEW_WINDOW_MS) return;

  const [cursor] = await db
    .select()
    .from(schema.syncCursors)
    .where(eq(schema.syncCursors.id, "drive_page_token"))
    .limit(1);
  const pageToken = cursor?.value ?? (await drive.getStartPageToken());

  const expirationEpochMs = Date.now() + DRIVE_CHANNEL_LIFETIME_MS;
  const channelId = newId("ch");
  const watch = await drive.watchChanges({
    pageToken,
    channelId,
    webhookUrl,
    expirationEpochMs,
    token: env.WEBHOOK_SHARED_SECRET,
  });

  const expirationDateTime = new Date(Number(watch.expiration)).toISOString();

  if (existing) {
    await db
      .update(schema.webhookSubscriptions)
      .set({
        subscriptionId: channelId,
        driveResourceId: watch.resourceId,
        expirationDateTime,
      })
      .where(eq(schema.webhookSubscriptions.id, existing.id));
  } else {
    await db.insert(schema.webhookSubscriptions).values({
      id: newId("wh"),
      provider: "drive",
      subscriptionId: channelId,
      driveResourceId: watch.resourceId,
      resourceUri: webhookUrl,
      expirationDateTime,
    });
  }
}
