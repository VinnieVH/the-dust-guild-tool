"use client";

import { useActionState, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { MainRole } from "@/lib/domain/enums";
import { CLASS_SPECS, WOW_CLASSES } from "@/lib/domain/wow";
import type { UnmatchedReservation } from "@/lib/repositories/reservation-queries";
import {
  type ResolveActionState,
  acceptSuggestionAction,
  createAndLinkAction,
  ignoreAction,
  linkAction,
  searchCharacters,
} from "./actions";

const initial: ResolveActionState = {};

type SearchHit = { id: string; name: string; class: string };

export function UnmatchedRow({
  reservation: r,
}: {
  reservation: UnmatchedReservation;
}) {
  const [linkState, link, linkPending] = useActionState(linkAction, initial);
  const [acceptState, accept, acceptPending] = useActionState(acceptSuggestionAction, initial);
  const [ignoreState, ignore, ignorePending] = useActionState(ignoreAction, initial);
  const [createState, create, createPending] = useActionState(createAndLinkAction, initial);

  const [hits, setHits] = useState<SearchHit[]>([]);
  const [picked, setPicked] = useState<SearchHit | null>(null);
  const [, startSearch] = useTransition();
  const [showCreate, setShowCreate] = useState(false);
  const [wowClass, setWowClass] = useState(WOW_CLASSES[0]);
  const specs = CLASS_SPECS[wowClass] ?? [];

  const message =
    linkState.error || acceptState.error || ignoreState.error || createState.error;
  const success =
    linkState.success || acceptState.success || ignoreState.success || createState.success;

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="font-medium text-fel-100">{r.rawName}</span>
          {r.rawClass && <span className="text-fel-200"> · {r.rawClass}</span>}
          <span className="ml-2 text-xs text-fel-200">
            {r.raidNightTitle} · {r.instance}
            {r.discordId && ` · reserved by <@${r.discordId}>`}
          </span>
        </div>
        <Badge variant="neutral">unmatched</Badge>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {r.suggestion && (
          <form action={accept}>
            <input type="hidden" name="reservationId" value={r.id} />
            <button
              type="submit"
              disabled={acceptPending}
              className="rounded border border-fel-700 px-2 py-1 text-sm text-fel-100 disabled:opacity-50"
            >
              {acceptPending ? "…" : `Accept → ${r.suggestion.name}`}
            </button>
          </form>
        )}

        {/* Link to an existing character via search */}
        <input
          placeholder="search character…"
          onChange={(e) => {
            const q = e.target.value;
            startSearch(async () => setHits(await searchCharacters(q)));
          }}
          className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm"
        />
        {hits.length > 0 && (
          <select
            className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm"
            value={picked?.id ?? ""}
            onChange={(e) =>
              setPicked(hits.find((h) => h.id === e.target.value) ?? null)
            }
          >
            <option value="">pick…</option>
            {hits.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name} ({h.class})
              </option>
            ))}
          </select>
        )}
        {picked && (
          <form action={link}>
            <input type="hidden" name="reservationId" value={r.id} />
            <input type="hidden" name="characterId" value={picked.id} />
            <button
              type="submit"
              disabled={linkPending}
              className="rounded border border-fel-700 px-2 py-1 text-sm text-fel-100 disabled:opacity-50"
            >
              {linkPending ? "…" : `Link → ${picked.name}`}
            </button>
          </form>
        )}

        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="rounded border border-neutral-700 px-2 py-1 text-sm text-fel-200"
        >
          Create character
        </button>

        <form action={ignore}>
          <input type="hidden" name="reservationId" value={r.id} />
          <button
            type="submit"
            disabled={ignorePending}
            className="rounded border border-neutral-700 px-2 py-1 text-sm text-fel-200 disabled:opacity-50"
          >
            {ignorePending ? "…" : "Ignore"}
          </button>
        </form>
      </div>

      {showCreate && (
        <form action={create} className="mt-3 flex flex-wrap items-end gap-2">
          <input type="hidden" name="reservationId" value={r.id} />
          <input
            name="name"
            defaultValue={r.rawName}
            className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm"
          />
          <select
            name="class"
            value={wowClass}
            onChange={(e) => setWowClass(e.target.value)}
            className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm"
          >
            {WOW_CLASSES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            name="spec"
            className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm"
          >
            {specs.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            name="mainRole"
            className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm"
          >
            {Object.values(MainRole).map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={createPending}
            className="rounded border border-fel-700 px-2 py-1 text-sm text-fel-100 disabled:opacity-50"
          >
            {createPending ? "…" : "Create & link"}
          </button>
        </form>
      )}

      {message && <p className="mt-2 text-sm text-red-400">{message}</p>}
      {success && <p className="mt-2 text-sm text-green-400">{success}</p>}
    </Card>
  );
}
