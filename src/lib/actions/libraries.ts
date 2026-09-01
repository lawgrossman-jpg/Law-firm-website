"use server";

import { revalidatePath } from "next/cache";
import { eq, ne, and } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireRole } from "@/lib/auth/session";
import { logAction } from "@/lib/audit";

export async function setLibraryEnabledAction(formData: FormData) {
  const session = await requireRole("partner");
  const libraryId = String(formData.get("libraryId"));
  const enabled = formData.get("enabled") === "true";

  const db = await getDb();
  await db
    .update(schema.sharepointLibraries)
    .set({ enabled })
    .where(eq(schema.sharepointLibraries.id, libraryId));

  await logAction({
    action: "sync.library_update",
    entityType: "sharepoint_library",
    entityId: libraryId,
    employeeId: session.employeeId,
    details: { enabled },
  });

  revalidatePath("/admin/sync");
}

/** Marks one library as the primary destination for new case folders,
 * unmarking any other (only one may be primary at a time). */
export async function setPrimaryLibraryAction(formData: FormData) {
  const session = await requireRole("partner");
  const libraryId = String(formData.get("libraryId"));

  const db = await getDb();
  await db
    .update(schema.sharepointLibraries)
    .set({ isPrimaryForCases: false })
    .where(
      and(eq(schema.sharepointLibraries.isPrimaryForCases, true), ne(schema.sharepointLibraries.id, libraryId)),
    );
  await db
    .update(schema.sharepointLibraries)
    .set({ isPrimaryForCases: true, enabled: true })
    .where(eq(schema.sharepointLibraries.id, libraryId));

  await logAction({
    action: "sync.library_update",
    entityType: "sharepoint_library",
    entityId: libraryId,
    employeeId: session.employeeId,
    details: { isPrimaryForCases: true },
  });

  revalidatePath("/admin/sync");
}
