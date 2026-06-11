import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ClassName } from "@/components/ui/class-name";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Tooltip } from "@/components/ui/tooltip";
import { WOW_CLASSES } from "@/lib/domain/wow";

// Demo page for the fel design-system primitives (plan §1.6).
export default function StyleguidePage() {
  return (
    <div className="flex flex-col gap-8 p-6">
      <header>
        <h1 className="text-2xl font-bold text-fel-300">Fel Styleguide</h1>
        <p className="text-fel-200">Dark Legion theme · fel-green accents · gold for achievements.</p>
      </header>

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
    </div>
  );
}
