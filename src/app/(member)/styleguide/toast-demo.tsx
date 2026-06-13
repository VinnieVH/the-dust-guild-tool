"use client";

import { useState } from "react";
import { AchievementToast } from "@/components/achievement-toast";
import type { NightAward } from "@/lib/repositories/night-results-queries";

// Styleguide-only demo of the achievement toast. The real toast fires once per
// award set (localStorage-gated); here we bump a key and clear that flag so the
// banner can be replayed on demand for visual review.
const DEMO_AWARDS: NightAward[] = [
  {
    key: "deadliest",
    name: "Deadliest",
    description: "Highest DPS parse of the night.",
    icon: "🗡️",
    category: "personal",
    winners: [{ characterName: "Skreamo", characterClass: "Warrior" }],
  },
  {
    key: "lifebinder",
    name: "Lifebinder",
    description: "Highest healer parse of the night.",
    icon: "✨",
    category: "personal",
    winners: [{ characterName: "Holypls", characterClass: "Priest" }],
  },
];

export function ToastDemo() {
  const [run, setRun] = useState(0);
  const raidNightId = `styleguide-demo-${run}`;

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          // Clear any prior demo seen-flags so it always replays.
          for (let i = 0; i <= run + 1; i++) {
            try {
              Object.keys(localStorage)
                .filter((k) => k.startsWith(`dust:awards-seen:styleguide-demo-${i}`))
                .forEach((k) => localStorage.removeItem(k));
            } catch {
              /* ignore */
            }
          }
          setRun((r) => r + 1);
        }}
        className="rounded border border-gold/60 px-3 py-1 text-sm text-gold hover:bg-legion-800"
      >
        Replay achievement toast
      </button>
      {run > 0 && <AchievementToast raidNightId={raidNightId} awards={DEMO_AWARDS} />}
    </div>
  );
}
