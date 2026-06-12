import type { ReserveOverview } from "@/lib/services/reserve-overview-service";

// Palette cycled across the night's sheets, so each sheet gets a distinct color
// even when there are more than two. On-theme: fel-green, gold, epic purple,
// then warmer fallbacks. Beyond the palette length it wraps (rare for a guild).
const PALETTE = [
  { fill: "bg-fel-500 shadow-[0_0_8px_var(--color-fel-glow)]", text: "text-fel-300", dot: "bg-fel-500" },
  { fill: "bg-gold", text: "text-gold", dot: "bg-gold" },
  { fill: "bg-epic", text: "text-epic", dot: "bg-epic" },
  { fill: "bg-sargeras", text: "text-sargeras", dot: "bg-sargeras" },
  { fill: "bg-felfire", text: "text-felfire", dot: "bg-felfire" },
] as const;
const color = (i: number) => PALETTE[i % PALETTE.length];

// One progress track with all sheets STACKED. Each sheet is drawn full-width to
// its own %, layered most-filled underneath → least-filled on top, so the
// exposed leading segment shows the color of whichever sheet is ahead and its
// length is exactly how far ahead it is. Overlaps show the trailing sheet's color.
export function SrProgress({ overview }: { overview: ReserveOverview }) {
  const { perSheet } = overview;
  if (perSheet.length === 0) return null;

  const total = perSheet[0].total;
  const pct = (done: number) =>
    total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;

  // Color is fixed per sheet (by its position), independent of stacking order.
  const colorBySheet = new Map(perSheet.map((s, i) => [s.sheetId, color(i)]));

  // Draw order: most-filled first (underneath), least-filled last (on top).
  const ordered = [...perSheet].sort((a, b) => b.done - a.done);

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-x-4 text-xs">
        <span className="text-fel-200">SR completion</span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {perSheet.map((s) => {
            const c = colorBySheet.get(s.sheetId)!;
            return (
              <span key={s.sheetId} className={`flex items-center gap-1 ${c.text}`}>
                <span className={`inline-block h-2 w-2 rounded-full ${c.dot}`} />
                {s.name} {s.done}/{total}
              </span>
            );
          })}
        </span>
      </div>
      <div className="relative h-3 w-full overflow-hidden rounded-full border border-fel-800 bg-legion-950">
        {ordered.map((s, i) => (
          <div
            key={s.sheetId}
            className={`absolute inset-y-0 left-0 transition-[width] ${colorBySheet.get(s.sheetId)!.fill}`}
            // Leader underneath (lower z), trailing on top (higher z) so the
            // overlap shows the trailing color and the leader's tail stays visible.
            style={{ width: `${pct(s.done)}%`, zIndex: i + 1 }}
            role="progressbar"
            aria-label={`${s.name} soft-res completion`}
            aria-valuenow={s.done}
            aria-valuemin={0}
            aria-valuemax={total}
          />
        ))}
      </div>
    </div>
  );
}
