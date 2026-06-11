"use client";

import { useActionState } from "react";
import { type SyncNightState, syncNightAction } from "./actions";

const initial: SyncNightState = {};

// Officer-only: re-pull this night's softres sheets on demand. Reservations are
// pull-based (no live updates), so this is how an officer refreshes the matrix
// after people reserve.
export function SyncNowButton({ raidNightId }: { raidNightId: string }) {
  const [state, action, pending] = useActionState(syncNightAction, initial);

  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="raidNightId" value={raidNightId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded border border-fel-700 px-3 py-1 text-sm text-fel-100 hover:bg-fel-900 disabled:opacity-50"
      >
        {pending ? "Syncing…" : "Sync now"}
      </button>
      {state.error && <span className="text-xs text-red-400">{state.error}</span>}
      {state.success && <span className="text-xs text-green-400">{state.success}</span>}
    </form>
  );
}
