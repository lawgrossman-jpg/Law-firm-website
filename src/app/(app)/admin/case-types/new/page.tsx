import { CaseTypeForm } from "../case-type-form";

export default function NewCaseTypePage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-slate-900">סוג תיק חדש</h1>
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <CaseTypeForm />
      </section>
    </div>
  );
}
