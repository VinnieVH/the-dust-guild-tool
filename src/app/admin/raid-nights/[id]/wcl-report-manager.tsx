"use client";

import { useActionState } from "react";
import type { AdminWclReport } from "@/lib/repositories/admin-queries";
import {
  type WclActionState,
  addWclReportAction,
  removeWclReportAction,
} from "../wcl-actions";

const initial: WclActionState = {};

const reportUrl = (code: string) => `https://www.warcraftlogs.com/reports/${code}`;

export function WclReportManager({
  raidNightId,
  reports,
}: {
  raidNightId: string;
  reports: AdminWclReport[];
}) {
  const [addState, add, adding] = useActionState(addWclReportAction, initial);
  const [removeState, remove, removing] = useActionState(removeWclReportAction, initial);

  return (
    <div className="flex flex-col gap-4">
      {reports.length > 0 && (
        <ul className="flex flex-col gap-2">
          {reports.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-3 rounded border border-fel-900 bg-legion-900 px-3 py-2"
            >
              <div className="min-w-0">
                <span className="font-medium text-fel-100">{r.zone}</span>
                <a
                  href={reportUrl(r.reportCode)}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-2 truncate text-xs text-fel-200 hover:text-fel-400"
                >
                  {r.reportCode}
                </a>
                <span className="ml-2 text-xs text-fel-200">
                  {r.performanceCount} performers
                  {r.unmatchedCount > 0 && (
                    <span className="text-amber-400"> · {r.unmatchedCount} unmatched</span>
                  )}
                </span>
              </div>
              <form action={remove}>
                <input type="hidden" name="raidNightId" value={raidNightId} />
                <input type="hidden" name="reportId" value={r.id} />
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
        <label className="flex flex-1 flex-col gap-1 text-sm">
          Warcraft Logs report
          <input
            name="url"
            required
            placeholder="https://www.warcraftlogs.com/reports/…"
            className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1"
          />
        </label>
        <button
          type="submit"
          disabled={adding}
          className="rounded border border-fel-700 px-3 py-1 text-fel-100 disabled:opacity-50"
        >
          {adding ? "Ingesting…" : "Add report"}
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
