"use server";

import { getDb, schema } from "@/db";
import { newId } from "@/lib/id";
import { requireSession } from "@/lib/auth/session";

export async function createClientAction(input: {
  fullName: string;
  idNumber?: string;
  phone?: string;
  email?: string;
  address?: string;
}): Promise<string> {
  await requireSession();
  const db = await getDb();
  const id = newId("client");
  await db.insert(schema.clients).values({
    id,
    fullName: input.fullName,
    idNumber: input.idNumber || null,
    phone: input.phone || null,
    email: input.email || null,
    address: input.address || null,
  });
  return id;
}
