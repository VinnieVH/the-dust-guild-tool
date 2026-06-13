import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ClassName } from "@/components/ui/class-name";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Tooltip } from "@/components/ui/tooltip";
import { WOW_CLASSES } from "@/lib/domain/wow";
import { ToastDemo } from "./toast-demo";

// Demo page for the fel design-system primitives (plan §1.6).
export default function StyleguidePage() {
  return (
    <div className="flex flex-col gap-8 p-6">
      <header>
        <h1 className="text-2xl font-bold text-fel-300">Fel Styleguide</h1>
        <p className="text-fel-200">
          Burning Legion theme · fel-green glow · Sargeras yellow · void violet · charred obsidian.
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Palette</h2>
        <div className="flex flex-wrap gap-3 text-xs">
          {[
            ["fel-500", "bg-fel-500", "#13FF29"],
            ["fel-400", "bg-fel-400", "#67F100"],
            ["fel-600", "bg-fel-600", "#7FD81E"],
            ["sargeras", "bg-sargeras", "#EEFF08"],
            ["void-violet", "bg-void-violet", "#711C58"],
            ["void-indigo", "bg-void-indigo", "#1E1130"],
            ["felfire", "bg-felfire", "#FF6A13"],
            ["gold", "bg-gold", "#FFCE1F"],
            ["legion-900", "bg-legion-900", "#0A0C0A"],
          ].map(([name, bg, hex]) => (
            <div key={name} className="flex flex-col items-center gap-1">
              <div className={`h-12 w-16 rounded border border-legion-700 ${bg}`} />
              <span className="text-fel-200">{name}</span>
              <span className="text-neutral-500">{hex}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Cards</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <h3 className="font-semibold text-fel-300">Serpentshrine Cavern</h3>
            <p className="text-sm">A dark panel with a fel-green border glow.</p>
          </Card>
          <Card>
            <h3 className="font-semibold text-fel-300">Tempest Keep</h3>
            <p className="text-sm">Used for raid nights and overviews.</p>
          </Card>
          <Card>
            <h3 className="font-semibold text-gold">Achievement</h3>
            <p className="text-sm">Gold accents are reserved for awards.</p>
          </Card>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Badges</h2>
        <div className="flex flex-wrap gap-2">
          <Badge variant="fel">Confirmed</Badge>
          <Badge variant="sargeras">Empowered</Badge>
          <Badge variant="void">Void-touched</Badge>
          <Badge variant="felfire">Burning</Badge>
          <Badge variant="epic">Epic</Badge>
          <Badge variant="gold">Deadliest</Badge>
          <Badge variant="neutral">Tentative</Badge>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Class-colored names</h2>
        <div className="flex flex-wrap gap-4">
          {WOW_CLASSES.map((c) => (
            <ClassName key={c} name={c} wowClass={c} />
          ))}
        </div>
      </section>

      <section className="flex max-w-md flex-col gap-3">
        <h2 className="text-lg font-semibold">Progress bar</h2>
        <ProgressBar value={18} max={25} label="SR completion" />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Tooltip (hover)</h2>
        <Tooltip
          title="Earthwarden"
          body={<span>Druid feral idol — increases Lacerate damage.</span>}
        >
          <span className="cursor-help underline decoration-dotted text-fel-300">
            Hover me
          </span>
        </Tooltip>
      </section>

      <section className="flex max-w-xl flex-col gap-3">
        <h2 className="text-lg font-semibold">Empty state</h2>
        <EmptyState
          title="Nothing here yet"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden>
              <circle cx="12" cy="12" r="9" />
              <path d="M9 10h.01M15 10h.01M9 15c.8-.8 2-1.2 3-1.2s2.2.4 3 1.2" strokeLinecap="round" />
            </svg>
          }
        >
          Placeholder for empty lists and not-yet-built pages — dashed fel
          border, ringed icon, supporting copy.
        </EmptyState>
      </section>

      <section className="flex max-w-xl flex-col gap-3">
        <h2 className="text-lg font-semibold">Achievement toast</h2>
        <p className="text-sm text-fel-200">
          WoW-style gold banner that fires when a raid night&apos;s results are
          first viewed (Phase 5.1). Replays the entrance + auto-advance here.
        </p>
        <ToastDemo />
      </section>
    </div>
  );
}
