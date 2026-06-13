"use client";

import { useActionState } from "react";
import { type GuildSyncState, refreshGuildDataAction } from "./guild-actions";

const initial: GuildSyncState = {};

// Officer-only: recompute attendance streaks + refresh guild zone rankings from
// WCL guild data (not report-derived, so it has its own trigger).
export function RefreshGuildButton() {
  const [state, action, pending] = useActionState(refreshGuildDataAction, initial);

  return (
    <form action={action} className="flex items-center gap-2">
      <button
        type="submit"
        disabled={pending}
        className="rounded border border-fel-700 px-3 py-1 text-sm text-fel-100 hover:bg-fel-900 disabled:opacity-50"
      >
        {pending ? "Refreshing…" : "Refresh guild data"}
      </button>
      {state.error && <span className="text-xs text-red-400">{state.error}</span>}
      {state.success && <span className="text-xs text-green-400">{state.success}</span>}
    </form>
  );
}
