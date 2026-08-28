import "server-only";
import { SignJWT, importPKCS8 } from "jose";
import { getCloudflareContext } from "@opennextjs/cloudflare";

const tokenCache = new Map<string, { token: string; expiresAt: number }>();

/** Acquires a Google OAuth2 access token via a service-account JWT bearer
 * grant (Workspace domain-wide delegation).
 *
 * When `impersonateEmail` is given (a specific employee's mapped Google
 * Workspace address), the token impersonates that user, so a write made
 * with it shows Drive's own `lastModifyingUser` as that employee — this is
 * how a SharePoint edit's author is carried over as the credited editor on
 * the Drive side, not just logged in our own audit table. Falls back to
 * GOOGLE_IMPERSONATED_ADMIN_EMAIL (or the bare service account) when no
 * mapped identity is known for the actor. */
export async function getDriveAccessToken(impersonateEmail?: string): Promise<string> {
  const { env } = await getCloudflareContext({ async: true });
  const subject =
    impersonateEmail || env.GOOGLE_IMPERSONATED_ADMIN_EMAIL || env.GOOGLE_SERVICE_ACCOUNT_EMAIL;

  const cached = tokenCache.get(subject);
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return cached.token;
  }

  const pem = env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, "\n");
  const privateKey = await importPKCS8(pem, "RS256");

  const now = Math.floor(Date.now() / 1000);
  const jwt = await new SignJWT({
    scope: "https://www.googleapis.com/auth/drive",
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(env.GOOGLE_SERVICE_ACCOUNT_EMAIL)
    .setSubject(subject)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(privateKey);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to acquire Drive token (subject=${subject}): ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  const token = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  tokenCache.set(subject, token);
  return token.token;
}
