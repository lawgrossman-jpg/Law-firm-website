"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DiscoverLibrariesButton() {
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const router = useRouter();

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        disabled={status === "running"}
        onClick={async () => {
          setStatus("running");
          try {
            const res = await fetch("/api/sync/discover-libraries", { method: "POST" });
            const data = (await res.json()) as { added?: string[]; error?: string };
            if (!res.ok || data.error) {
              setStatus("error");
              setMessage(data.error ?? "שגיאה");
            } else {
              setStatus("done");
              setMessage(
                data.added && data.added.length > 0
                  ? `נוספו: ${data.added.join(", ")}`
                  : "לא נמצאו ספריות חדשות",
              );
              router.refresh();
            }
          } catch (err) {
            setStatus("error");
            setMessage(err instanceof Error ? err.message : String(err));
          }
        }}
        className="rounded-md bg-slate-100 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-200 disabled:opacity-60"
      >
        {status === "running" ? "בודק..." : "גילוי ספריות"}
      </button>
      {status === "done" && <span className="text-xs text-green-700">{message}</span>}
      {status === "error" && <span className="text-xs text-red-600">{message}</span>}
    </div>
  );
}
