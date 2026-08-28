import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";

// Module-level cache: persists across requests handled by the same Worker
// isolate, which is a valid (not guaranteed-durable) optimization — a cold
// isolate simply re-fetches a token.
let cachedToken: { token: string; expiresAt: number } | null = null;

/** Acquires a Microsoft Graph app-only access token via the client
 * credentials flow (Azure AD app registration with SharePoint/Sites
 * application permissions, admin-consented). */
export async function getGraphAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }

  const { env } = await getCloudflareContext({ async: true });
  const tokenUrl = `https://login.microsoftonline.com/${env.MS_TENANT_ID}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: env.MS_CLIENT_ID,
    client_secret: env.MS_CLIENT_SECRET,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    throw new Error(`Failed to acquire Graph token: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedToken.token;
}
