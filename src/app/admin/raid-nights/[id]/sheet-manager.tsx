"use client";

import { useActionState, useState } from "react";
import type { AdminSheet } from "@/lib/repositories/admin-queries";
import {
  type SheetActionState,
  addSheetAction,
  removeSheetAction,
  setTokenAction,
} from "../actions";

const initial: SheetActionState = {};

const softresUrl = (id: string) => `https://softres.it/raid/${id}`;

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      className="h-4 w-4"
      aria-hidden
    >
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" />
      {off && <path d="M3 3l18 18" strokeLinecap="round" />}
    </svg>
  );
}

// One sheet row: link + remove, plus the softres admin-key (token) field. The
// key is rendered as a password input behind an eye toggle and saved via its
// own server action so officers can recover/rotate it without re-adding sheets.
function SheetRow({
  raidNightId,
  sheet,
}: {
  raidNightId: string;
  sheet: AdminSheet;
}) {
  const [removeState, remove, removing] = useActionState(removeSheetAction, initial);
  const [tokenState, saveToken, savingToken] = useActionState(setTokenAction, initial);
  const [revealed, setRevealed] = useState(false);

  return (
    <li className="flex flex-col gap-1 rounded border border-fel-900 bg-legion-900 px-3 py-2">
      <div className="flex items-center gap-3">
        <div className="min-w-0 shrink-0">
          <span className="font-medium text-fel-100">{sheet.name}</span>
          <a
            href={softresUrl(sheet.softresId)}
            target="_blank"
            rel="noreferrer"
            className="ml-2 truncate text-xs text-fel-200 hover:text-fel-400"
          >
            softres.it/raid/{sheet.softresId}
          </a>
        </div>

        <form action={saveToken} className="ml-auto flex items-stretch gap-1">
          <input type="hidden" name="raidNightId" value={raidNightId} />
          <input type="hidden" name="sheetId" value={sheet.id} />
          <input
            name="token"
            type={revealed ? "text" : "password"}
            defaultValue={sheet.token ?? ""}
            autoComplete="off"
            maxLength={32}
            size={12}
            aria-label="Admin key"
            placeholder="admin key"
            className="w-28 rounded border border-neutral-700 bg-neutral-900 px-2 py-1 font-mono text-xs"
          />
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            aria-label={revealed ? "Hide admin key" : "Show admin key"}
            aria-pressed={revealed}
            className="rounded border border-neutral-700 px-2 text-fel-200 hover:text-fel-100"
          >
            <EyeIcon off={revealed} />
          </button>
          <button
            type="submit"
            disabled={savingToken}
            className="rounded border border-fel-700 px-2 py-1 text-xs text-fel-100 disabled:opacity-50"
          >
            {savingToken ? "…" : "Save"}
          </button>
        </form>

        <form action={remove} className="shrink-0">
          <input type="hidden" name="raidNightId" value={raidNightId} />
          <input type="hidden" name="sheetId" value={sheet.id} />
          <button
            type="submit"
            disabled={removing}
            className="rounded border border-neutral-700 px-2 py-1 text-xs text-fel-200 hover:border-red-500 hover:text-red-400 disabled:opacity-50"
          >
            {removing ? "…" : "Remove"}
          </button>
        </form>
      </div>

      {(removeState.error || tokenState.error) && (
        <p className="text-xs text-red-400">{removeState.error || tokenState.error}</p>
      )}
      {tokenState.success && <p className="text-xs text-green-400">{tokenState.success}</p>}
    </li>
  );
}

export function SheetManager({
  raidNightId,
  sheets,
}: {
  raidNightId: string;
  sheets: AdminSheet[];
}) {
  const [addState, add, adding] = useActionState(addSheetAction, initial);

  return (
    <div className="flex flex-col gap-4">
      {sheets.length > 0 && (
        <ul className="flex flex-col gap-2">
          {sheets.map((s) => (
            <SheetRow key={s.id} raidNightId={raidNightId} sheet={s} />
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

      {addState.error && <p className="text-sm text-red-400">{addState.error}</p>}
      {addState.success && <p className="text-sm text-green-400">{addState.success}</p>}
    </div>
  );
}
