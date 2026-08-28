import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { logoutAction } from "@/lib/actions/auth";

const ROLE_LABELS: Record<string, string> = {
  partner: "שותף",
  associate: "עו״ד שכיר",
  intern: "מתמחה",
  secretary: "מזכירות",
  admin: "מנהל מערכת",
};

const NAV_ITEMS = [
  { href: "/dashboard", label: "לוח בקרה" },
  { href: "/cases", label: "תיקים" },
  { href: "/tasks", label: "משימות" },
  { href: "/documents/generate", label: "מחולל מסמכים" },
  { href: "/admin/sync", label: "סנכרון SharePoint ↔ Drive" },
  { href: "/admin/employees", label: "עובדים" },
  { href: "/admin/audit-log", label: "יומן אירועים" },
];

export default async function AppLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-64 shrink-0 flex-col border-l border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <p className="text-sm font-semibold text-slate-900">
            מערכת ניהול משרד עו״ד
          </p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-slate-200 p-3">
          <p className="px-3 text-xs text-slate-500">{session.fullName}</p>
          <p className="px-3 pb-2 text-xs text-slate-400">
            {ROLE_LABELS[session.role] ?? session.role}
          </p>
          <form action={logoutAction}>
            <button
              type="submit"
              className="w-full rounded-md px-3 py-2 text-right text-sm text-slate-700 hover:bg-slate-100"
            >
              התנתקות
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 overflow-x-hidden">
        <div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
