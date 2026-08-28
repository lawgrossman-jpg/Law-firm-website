import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { EmployeeRole } from "@/db/schema";

const COOKIE_NAME = "lfm_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12h

export type SessionPayload = {
  employeeId: string;
  email: string;
  fullName: string;
  role: EmployeeRole;
};

async function getSecretKey() {
  const { env } = await getCloudflareContext({ async: true });
  const secret = env.SESSION_JWT_SECRET;
  if (!secret) {
    throw new Error(
      "SESSION_JWT_SECRET is not configured (wrangler secret put SESSION_JWT_SECRET)",
    );
  }
  return new TextEncoder().encode(secret);
}

export async function createSession(payload: SessionPayload) {
  const key = await getSecretKey();
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(key);

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const key = await getSecretKey();
    const { payload } = await jwtVerify(token, key);
    return {
      employeeId: payload.employeeId as string,
      email: payload.email as string,
      fullName: payload.fullName as string,
      role: payload.role as EmployeeRole,
    };
  } catch {
    return null;
  }
}

export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    throw new AuthError("Not authenticated");
  }
  return session;
}

export class AuthError extends Error {}

const ROLE_RANK: Record<EmployeeRole, number> = {
  intern: 0,
  secretary: 1,
  associate: 2,
  partner: 3,
  admin: 4,
};

/** Throws if the current session's role is below `minRole`. */
export async function requireRole(minRole: EmployeeRole): Promise<SessionPayload> {
  const session = await requireSession();
  if (ROLE_RANK[session.role] < ROLE_RANK[minRole]) {
    throw new AuthError(`Requires role >= ${minRole}`);
  }
  return session;
}
