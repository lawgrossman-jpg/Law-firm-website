import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireSession, AuthError } from "@/lib/auth/session";
import { fetchDocumentBytes } from "@/lib/documents/fetch";
import { logAction } from "@/lib/audit";

/** Streams a document's bytes as a forced download. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const { documentId } = await params;

  let employeeId: string;
  try {
    employeeId = (await requireSession()).employeeId;
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    throw err;
  }

  const db = await getDb();
  const [doc] = await db.select().from(schema.documents).where(eq(schema.documents.id, documentId)).limit(1);
  if (!doc) return NextResponse.json({ error: "not found" }, { status: 404 });

  let bytes: ArrayBuffer;
  try {
    bytes = await fetchDocumentBytes(doc);
  } catch (err) {
    return NextResponse.json(
      { error: `לא ניתן היה לטעון את הקובץ: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 },
    );
  }

  await logAction({
    action: "document.download",
    entityType: "document",
    entityId: doc.id,
    employeeId,
  });

  return new NextResponse(bytes, {
    headers: {
      "Content-Type": doc.mimeType ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(doc.name)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
