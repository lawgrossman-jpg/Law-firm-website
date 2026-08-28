"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { createSession, destroySession, requireSession } from "@/lib/auth/session";
import { verifyPassword } from "@/lib/auth/password";
import { logAction } from "@/lib/audit";

export type LoginState = { error?: string } | undefined;

export async function loginAction(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "יש להזין אימייל וסיסמה" };
  }

  const db = await getDb();
  const [employee] = await db
    .select()
    .from(schema.employees)
    .where(eq(schema.employees.email, email))
    .limit(1);

  if (!employee || !employee.active) {
    return { error: "פרטי התחברות שגויים" };
  }

  const ok = await verifyPassword(password, employee.passwordHash);
  if (!ok) {
    return { error: "פרטי התחברות שגויים" };
  }

  await createSession({
    employeeId: employee.id,
    email: employee.email,
    fullName: employee.fullName,
    role: employee.role,
  });

  const ipAddress = (await headers()).get("cf-connecting-ip") ?? undefined;
  await logAction({
    action: "login",
    entityType: "employee",
    entityId: employee.id,
    employeeId: employee.id,
    ipAddress,
  });

  redirect("/dashboard");
}

export async function logoutAction() {
  const session = await requireSession().catch(() => null);
  await destroySession();
  if (session) {
    await logAction({
      action: "logout",
      entityType: "employee",
      entityId: session.employeeId,
      employeeId: session.employeeId,
    });
  }
  redirect("/login");
}
