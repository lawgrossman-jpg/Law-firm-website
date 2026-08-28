"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { EmployeeRole } from "@/db/schema";
import { newId } from "@/lib/id";
import { hashPassword } from "@/lib/auth/password";
import { requireRole } from "@/lib/auth/session";
import { logAction } from "@/lib/audit";

export type EmployeeFormState = { error?: string } | undefined;

export async function createEmployeeAction(
  _prevState: EmployeeFormState,
  formData: FormData,
): Promise<EmployeeFormState> {
  const session = await requireRole("partner");

  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "associate") as EmployeeRole;

  if (!fullName || !email || password.length < 8) {
    return { error: "יש למלא שם, אימייל וסיסמה (8 תווים לפחות)" };
  }

  const db = await getDb();
  const [existing] = await db
    .select({ id: schema.employees.id })
    .from(schema.employees)
    .where(eq(schema.employees.email, email))
    .limit(1);
  if (existing) {
    return { error: "כבר קיים עובד עם אימייל זה" };
  }

  const id = newId("emp");
  await db.insert(schema.employees).values({
    id,
    fullName,
    email,
    passwordHash: await hashPassword(password),
    role,
  });

  await logAction({
    action: "employee.create",
    entityType: "employee",
    entityId: id,
    employeeId: session.employeeId,
    details: { fullName, email, role },
  });

  revalidatePath("/admin/employees");
}

export async function setEmployeeActiveAction(formData: FormData) {
  const session = await requireRole("partner");
  const employeeId = String(formData.get("employeeId"));
  const active = formData.get("active") === "true";

  const db = await getDb();
  await db
    .update(schema.employees)
    .set({ active })
    .where(eq(schema.employees.id, employeeId));

  await logAction({
    action: "employee.update",
    entityType: "employee",
    entityId: employeeId,
    employeeId: session.employeeId,
    details: { active },
  });

  revalidatePath("/admin/employees");
}
