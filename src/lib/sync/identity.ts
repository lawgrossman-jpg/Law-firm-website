import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";

export type ResolvedActor = {
  employeeId: string | null;
  /** Human-readable label for the audit log when no employee match exists. */
  label: string;
  /** The employee's mapped Google Workspace address, if known — used to
   * impersonate them on Drive writes so credit carries over correctly. */
  googleEmail?: string;
};

/** Resolves a SharePoint/Graph editor identity (from driveItem.lastModifiedBy)
 * to an internal employee via user_identity_map. */
export async function resolveActorFromGraph(user?: {
  id?: string;
  displayName?: string;
  email?: string;
}): Promise<ResolvedActor> {
  if (!user?.id) return { employeeId: null, label: "SharePoint" };

  const db = await getDb();
  const [mapping] = await db
    .select()
    .from(schema.userIdentityMap)
    .where(eq(schema.userIdentityMap.msUserId, user.id))
    .limit(1);

  if (mapping) {
    const [emp] = await db
      .select()
      .from(schema.employees)
      .where(eq(schema.employees.id, mapping.employeeId))
      .limit(1);
    return {
      employeeId: mapping.employeeId,
      label: emp?.fullName ?? user.displayName ?? "SharePoint",
      googleEmail: mapping.googleEmail ?? undefined,
    };
  }

  return { employeeId: null, label: `${user.displayName ?? "לא ידוע"} (SharePoint)` };
}

/** Resolves a Google Drive editor identity (from file.lastModifyingUser)
 * to an internal employee via user_identity_map. */
export async function resolveActorFromDrive(user?: {
  emailAddress?: string;
  displayName?: string;
}): Promise<ResolvedActor> {
  if (!user?.emailAddress) return { employeeId: null, label: "Google Drive" };

  const db = await getDb();
  const [mapping] = await db
    .select()
    .from(schema.userIdentityMap)
    .where(eq(schema.userIdentityMap.googleEmail, user.emailAddress))
    .limit(1);

  if (mapping) {
    const [emp] = await db
      .select()
      .from(schema.employees)
      .where(eq(schema.employees.id, mapping.employeeId))
      .limit(1);
    return { employeeId: mapping.employeeId, label: emp?.fullName ?? user.displayName ?? "Google Drive" };
  }

  return { employeeId: null, label: `${user.displayName ?? "לא ידוע"} (Google Drive)` };
}
