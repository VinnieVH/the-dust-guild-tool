"use client";

import { useActionState, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { UnmatchedPerformance } from "@/lib/repositories/wcl-unmatched-queries";
import {
  type ResolveActionState,
  linkPerformanceAction,
  searchCharacters,
} from "./actions";

const initial: ResolveActionState = {};

type SearchHit = { id: string; name: string; class: string };

export function WclUnmatchedRow({ perf }: { perf: UnmatchedPerformance }) {
  const [linkState, link, linkPending] = useActionState(linkPerformanceAction, initial);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [picked, setPicked] = useState<SearchHit | null>(null);
  const [, startSearch] = useTransition();

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="font-medium text-fel-100">{perf.rawName}</span>
          <span className="ml-2 text-xs text-fel-200">
            {perf.role} · {perf.occurrences} performance{perf.occurrences === 1 ? "" : "s"}
          </span>
        </div>
        <Badge variant="neutral">unmatched (WCL)</Badge>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
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
            onChange={(e) => setPicked(hits.find((h) => h.id === e.target.value) ?? null)}
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
            <input type="hidden" name="rawName" value={perf.rawName} />
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
      </div>

      {linkState.error && <p className="mt-2 text-sm text-red-400">{linkState.error}</p>}
      {linkState.success && <p className="mt-2 text-sm text-green-400">{linkState.success}</p>}
    </Card>
  );
}
