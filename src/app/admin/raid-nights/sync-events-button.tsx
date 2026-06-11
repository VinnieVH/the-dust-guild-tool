"use client";

import { useActionState } from "react";
import { type SyncEventsState, syncRaidHelperAction } from "./sync-actions";

const initial: SyncEventsState = {};

// Officer-only: pull the latest Raid-Helper events + signups into the DB.
export function SyncEventsButton() {
  const [state, action, pending] = useActionState(syncRaidHelperAction, initial);

  return (
    <form action={action} className="flex items-center gap-2">
      <button
        type="submit"
        disabled={pending}
        className="rounded border border-fel-700 px-3 py-1 text-sm text-fel-100 hover:bg-fel-900 disabled:opacity-50"
      >
        {pending ? "Syncing…" : "Sync Raid-Helper"}
      </button>
      {state.error && <span className="text-xs text-red-400">{state.error}</span>}
      {state.success && <span className="text-xs text-green-400">{state.success}</span>}
    </form>
  );
}
