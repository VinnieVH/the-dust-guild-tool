"use client";

import { useState, useTransition } from "react";
import { ignoreAllPerformancesAction } from "./actions";

// "Dismiss all current WCL unmatched names" — clears the pug backlog in one
// click. Confirms first (bulk + not obvious how to undo from the UI), then
// shows the result. Reversible per-name later by linking the name to a
// character, which removes it from the ignore list.
export function DismissAllButton({ count }: { count: number }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  if (count === 0) return null;

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!confirm(`Dismiss all ${count} unmatched WCL names? They're hidden from the queue; you can still link any of them later.`)) {
            return;
          }
          start(async () => {
            const res = await ignoreAllPerformancesAction();
            setMsg(res.success ?? res.error ?? null);
          });
        }}
        className="rounded border border-neutral-700 px-3 py-1 text-sm text-fel-200 hover:text-fel-100 disabled:opacity-50"
      >
        {pending ? "Dismissing…" : `Dismiss all ${count}`}
      </button>
      {msg && <span className="text-sm text-green-400">{msg}</span>}
    </div>
  );
}
