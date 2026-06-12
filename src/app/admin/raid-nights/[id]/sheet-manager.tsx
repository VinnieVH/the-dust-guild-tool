"use client";

import { useActionState } from "react";
import type { AdminSheet } from "@/lib/repositories/admin-queries";
import {
  type SheetActionState,
  addSheetAction,
  removeSheetAction,
} from "../actions";

const initial: SheetActionState = {};

const softresUrl = (id: string) => `https://softres.it/raid/${id}`;

export function SheetManager({
  raidNightId,
  sheets,
}: {
  raidNightId: string;
  sheets: AdminSheet[];
}) {
  const [addState, add, adding] = useActionState(addSheetAction, initial);
  const [removeState, remove, removing] = useActionState(removeSheetAction, initial);

  return (
    <div className="flex flex-col gap-4">
      {sheets.length > 0 && (
        <ul className="flex flex-col gap-2">
          {sheets.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between gap-3 rounded border border-fel-900 bg-legion-900 px-3 py-2"
            >
              <div className="min-w-0">
                <span className="font-medium text-fel-100">{s.name}</span>
                <a
                  href={softresUrl(s.softresId)}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-2 truncate text-xs text-fel-200 hover:text-fel-400"
                >
                  softres.it/raid/{s.softresId}
                </a>
              </div>
              <form action={remove}>
                <input type="hidden" name="raidNightId" value={raidNightId} />
                <input type="hidden" name="sheetId" value={s.id} />
                <button
                  type="submit"
                  disabled={removing}
                  className="rounded border border-neutral-700 px-2 py-1 text-xs text-fel-200 hover:border-red-500 hover:text-red-400 disabled:opacity-50"
                >
                  {removing ? "…" : "Remove"}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <form action={add} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="raidNightId" value={raidNightId} />
        <label className="flex flex-col gap-1 text-sm">
          Sheet name
          <input
            name="name"
            required
            maxLength={40}
            placeholder="SSC"
            className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1"
          />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-sm">
          softres link
          <input
            name="url"
            required
            placeholder="https://softres.it/raid/…"
            className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1"
          />
        </label>
        <button
          type="submit"
          disabled={adding}
          className="rounded border border-fel-700 px-3 py-1 text-fel-100 disabled:opacity-50"
        >
          {adding ? "Adding…" : "Add & sync"}
        </button>
      </form>

      {(addState.error || removeState.error) && (
        <p className="text-sm text-red-400">{addState.error || removeState.error}</p>
      )}
      {(addState.success || removeState.success) && (
        <p className="text-sm text-green-400">{addState.success || removeState.success}</p>
      )}
    </div>
  );
}
