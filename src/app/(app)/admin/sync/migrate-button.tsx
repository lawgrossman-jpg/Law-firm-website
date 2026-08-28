"use client";

import { useState } from "react";

export function MigrateButton() {
  const [status, setStatus] = useState<"idle" | "starting" | "started" | "error">("idle");

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        disabled={status === "starting"}
        onClick={async () => {
          setStatus("starting");
          try {
            const res = await fetch("/api/sync/migrate", { method: "POST" });
            setStatus(res.ok ? "started" : "error");
          } catch {
            setStatus("error");
          }
        }}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
      >
        {status === "starting" ? "מתחיל..." : "הרצת הגירה מלאה"}
      </button>
      {status === "started" && (
        <span className="text-sm text-green-700">
          ההגירה החלה ברקע. עקבו אחר ההתקדמות ביומן האירועים.
        </span>
      )}
      {status === "error" && <span className="text-sm text-red-600">שגיאה בהפעלת ההגירה</span>}
    </div>
  );
}
