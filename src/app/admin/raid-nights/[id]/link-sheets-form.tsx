"use client";

import { useActionState } from "react";
import { type LinkSheetsState, linkSheetsAction } from "../actions";

const initial: LinkSheetsState = {};

export function LinkSheetsForm({
  raidNightId,
  sscDefault,
  tkDefault,
}: {
  raidNightId: string;
  sscDefault: string;
  tkDefault: string;
}) {
  const [state, action, pending] = useActionState(linkSheetsAction, initial);

  return (
    <form action={action} className="flex max-w-xl flex-col gap-3">
      <input type="hidden" name="raidNightId" value={raidNightId} />

      <label className="flex flex-col gap-1 text-sm">
        SSC softres link
        <input
          name="ssc"
          defaultValue={sscDefault}
          placeholder="https://softres.it/raid/…"
          className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        TK softres link
        <input
          name="tk"
          defaultValue={tkDefault}
          placeholder="https://softres.it/raid/…"
          className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1"
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded border border-fel-700 px-3 py-1 text-fel-100 disabled:opacity-50"
      >
        {pending ? "Linking & syncing…" : "Link & sync sheets"}
      </button>

      {state.error && <p className="text-sm text-red-400">{state.error}</p>}
      {state.success && <p className="text-sm text-green-400">{state.success}</p>}
    </form>
  );
}
