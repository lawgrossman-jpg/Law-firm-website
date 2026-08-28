"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { newId } from "@/lib/id";
import { requireRole } from "@/lib/auth/session";
import { logAction } from "@/lib/audit";
import { getGraphAccessToken } from "@/lib/msgraph/token";

/** Maps an employee to their Microsoft 365 (SharePoint) and Google
 * Workspace (Drive) identities, so file edits made in either cloud are
 * attributed to the right employee (see src/lib/sync/identity.ts). The
 * Microsoft user's Graph object id is resolved from the UPN automatically
 * (requires the app registration's User.Read.All permission) since that's
 * what driveItem.lastModifiedBy.user.id reports — not the UPN itself. */
export async function setEmployeeIdentityMappingAction(formData: FormData) {
  const session = await requireRole("partner");
  const employeeId = String(formData.get("employeeId"));
  const msUserPrincipalName = String(formData.get("msUserPrincipalName") ?? "").trim() || null;
  const googleEmail = String(formData.get("googleEmail") ?? "").trim() || null;

  let msUserId: string | null = null;
  if (msUserPrincipalName) {
    try {
      const token = await getGraphAccessToken();
      const res = await fetch(
        `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(msUserPrincipalName)}?$select=id`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (res.ok) {
        const data = (await res.json()) as { id: string };
        msUserId = data.id;
      }
    } catch {
      // Best-effort: leave msUserId unset if Graph lookup fails (e.g. no
      // credentials configured yet); the UPN is still stored for reference.
    }
  }

  const db = await getDb();
  const [existing] = await db
    .select({ id: schema.userIdentityMap.id })
    .from(schema.userIdentityMap)
    .where(eq(schema.userIdentityMap.employeeId, employeeId))
    .limit(1);

  if (existing) {
    await db
      .update(schema.userIdentityMap)
      .set({ msUserPrincipalName, msUserId, googleEmail })
      .where(eq(schema.userIdentityMap.id, existing.id));
  } else {
    await db.insert(schema.userIdentityMap).values({
      id: newId("idmap"),
      employeeId,
      msUserPrincipalName,
      msUserId,
      googleEmail,
    });
  }

  await logAction({
    action: "employee.update",
    entityType: "employee",
    entityId: employeeId,
    employeeId: session.employeeId,
    details: { identityMapping: { msUserPrincipalName, msUserId, googleEmail } },
  });

  revalidatePath("/admin/employees");
}
