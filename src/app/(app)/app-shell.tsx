"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { logoutAction } from "@/lib/actions/auth";
import type { EmployeeRole } from "@/db/schema";

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

export function AppShell({
  session,
  children,
}: {
  session: { fullName: string; role: EmployeeRole };
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col sm:flex-row">
      {/* Mobile top bar */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 sm:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="פתיחת תפריט"
          className="rounded-md p-2 text-slate-700 hover:bg-slate-100"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
          </svg>
        </button>
        <p className="text-sm font-semibold text-slate-900">מערכת ניהול משרד עו״ד</p>
        <div className="w-9" />
      </div>

      {/* Backdrop (mobile only, while menu open) */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/30 sm:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 right-0 z-50 flex w-64 shrink-0 transform flex-col border-l border-slate-200 bg-white transition-transform duration-200 ease-in-out sm:static sm:z-auto sm:flex sm:translate-x-0 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <p className="text-sm font-semibold text-slate-900">מערכת ניהול משרד עו״ד</p>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="סגירת תפריט"
            className="rounded-md p-1 text-slate-500 hover:bg-slate-100 sm:hidden"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6l-12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
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

      <main className="min-w-0 flex-1 overflow-x-hidden">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</div>
      </main>
    </div>
  );
}
