import { Instance } from "@/lib/domain/enums";
import type { ReserveOverview } from "@/lib/services/reserve-overview-service";

// Per-instance fill + label colors so the two are distinguishable at a glance.
const FILL: Record<Instance, string> = {
  [Instance.SSC]: "bg-fel-500 shadow-[0_0_8px_var(--color-fel-glow)]",
  [Instance.TK]: "bg-gold shadow-[0_0_8px_color-mix(in_srgb,var(--color-gold)_60%,transparent)]",
};
const LABEL: Record<Instance, string> = {
  [Instance.SSC]: "text-fel-300",
  [Instance.TK]: "text-gold",
};
const DOT: Record<Instance, string> = {
  [Instance.SSC]: "bg-fel-500",
  [Instance.TK]: "bg-gold",
};

// One progress track with both instances STACKED. The more-filled instance is
// drawn underneath (full width to its %), the less-filled on top — so the
// exposed leading segment shows the color of whichever instance is ahead, and
// its length is exactly how far ahead it is. Where they overlap you see the
// trailing instance's color.
export function SrProgress({ overview }: { overview: ReserveOverview }) {
  const { perInstance } = overview;
  if (perInstance.length === 0) return null;

  const total = perInstance[0].total;
  const pct = (done: number) =>
    total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;

  // Sort descending by completion: index 0 is the leader (drawn underneath).
  const ordered = [...perInstance].sort((a, b) => b.done - a.done);

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-x-4 text-xs">
        <span className="text-fel-200">SR completion</span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {perInstance.map(({ instance, done }) => (
            <span key={instance} className={`flex items-center gap-1 ${LABEL[instance]}`}>
              <span className={`inline-block h-2 w-2 rounded-full ${DOT[instance]}`} />
              {instance} {done}/{total}
            </span>
          ))}
        </span>
      </div>
      <div className="relative h-3 w-full overflow-hidden rounded-full border border-fel-800 bg-legion-950">
        {ordered.map(({ instance, done }, i) => (
          <div
            key={instance}
            className={`absolute inset-y-0 left-0 transition-[width] ${FILL[instance]}`}
            // Leader underneath (lower z), trailing on top (higher z) so the
            // overlap shows the trailing color and the leader's tail stays visible.
            style={{ width: `${pct(done)}%`, zIndex: i + 1 }}
            role="progressbar"
            aria-label={`${instance} soft-res completion`}
            aria-valuenow={done}
            aria-valuemin={0}
            aria-valuemax={total}
          />
        ))}
      </div>
    </div>
  );
}
