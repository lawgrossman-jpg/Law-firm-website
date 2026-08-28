// Tiny standalone Cloudflare Worker whose only job is to fire the main
// app's /api/cron/tick endpoint once an hour (Cron Trigger), so Graph and
// Drive webhook subscriptions get renewed before they expire, and any
// missed webhook notification is caught by a polling fallback pass.
//
// The main app (built with @opennextjs/cloudflare) doesn't export a
// `scheduled` handler of its own, so this sidesteps needing to hand-edit
// its generated worker bundle. Deploy with `wrangler deploy` from inside
// this directory after setting APP_BASE_URL in wrangler.toml and the
// CRON_SECRET secret (must match the main app's WEBHOOK_SHARED_SECRET).

const handler = {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(
      fetch(`${env.APP_BASE_URL}/api/cron/tick`, {
        method: "POST",
        headers: { "x-cron-secret": env.CRON_SECRET },
      }).then(async (res) => {
        if (!res.ok) {
          console.error("cron tick failed", res.status, await res.text());
        }
      }),
    );
  },
};

export default handler;
