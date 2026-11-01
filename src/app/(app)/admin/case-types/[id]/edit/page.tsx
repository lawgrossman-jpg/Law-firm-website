import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { CaseTypeForm } from "../../case-type-form";

export default async function EditCaseTypePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = await getDb();
  const [caseType] = await db
    .select()
    .from(schema.caseTypes)
    .where(eq(schema.caseTypes.id, id))
    .limit(1);

  if (!caseType) notFound();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-slate-900">עריכת סוג תיק: {caseType.name}</h1>
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <CaseTypeForm caseType={caseType} />
      </section>
    </div>
  );
}
