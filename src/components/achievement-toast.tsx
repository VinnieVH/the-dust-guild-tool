"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import type { NightAward } from "@/lib/repositories/night-results-queries";

// WoW-style gold banner toast: fires once when a raid night's results are FIRST
// viewed. "First" is keyed on (raidNightId + a hash of the award set) in
// localStorage, so re-ingesting a report that changes the awards re-fires, but
// revisiting the same results stays silent. Respects prefers-reduced-motion.

const SEEN_PREFIX = "dust:awards-seen:";

// A stable fingerprint of the award set: which achievement went to which
// character. Order-independent within the set (the query already sorts), so the
// same outcome always hashes the same string.
function awardsFingerprint(awards: NightAward[]): string {
  return awards
    .map((a) => `${a.key}:${a.winners.map((w) => w.characterName).join(",")}`)
    .sort()
    .join("|");
}

function seenKey(raidNightId: string, awards: NightAward[]): string {
  return `${SEEN_PREFIX}${raidNightId}:${awardsFingerprint(awards)}`;
}

export function AchievementToast({
  raidNightId,
  awards,
}: {
  raidNightId: string;
  awards: NightAward[];
}) {
  const reduceMotion = useReducedMotion();
  // Index of the banner currently shown; -1 = nothing to show (already seen, or
  // no awards). The lazy initializer READS localStorage synchronously on the
  // first client render (returns -1 during SSR, where `window` is absent), so
  // there's no flash — the unseen check happens before the first paint. The
  // matching WRITE (mark-as-seen) lives in an effect so it runs once after the
  // commit, not during render (which would double-fire under StrictMode).
  const [index, setIndex] = useState<number>(() => {
    if (typeof window === "undefined" || awards.length === 0) return -1;
    try {
      return localStorage.getItem(seenKey(raidNightId, awards)) ? -1 : 0;
    } catch {
      return 0; // localStorage blocked (private mode) — show once anyway.
    }
  });

  // Mark this award set seen once we've committed to showing it.
  useEffect(() => {
    if (index !== 0) return;
    try {
      localStorage.setItem(seenKey(raidNightId, awards), "1");
    } catch {
      // localStorage unavailable — non-fatal; it just re-fires next visit.
    }
  }, [index, raidNightId, awards]);

  // Auto-advance through the awards, one banner at a time.
  useEffect(() => {
    if (index < 0 || index >= awards.length) return;
    const timer = setTimeout(() => setIndex((i) => i + 1), 4000);
    return () => clearTimeout(timer);
  }, [index, awards.length]);

  const current = index >= 0 && index < awards.length ? awards[index] : null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4"
      aria-live="polite"
    >
      <AnimatePresence mode="wait">
        {current && (
          <motion.div
            key={current.key}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -24, scale: 0.96 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -16, scale: 0.98 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            onClick={() => setIndex((i) => i + 1)}
            role="status"
            className="pointer-events-auto flex max-w-md cursor-pointer items-center gap-3 rounded-lg border-2 border-gold bg-legion-900/95 px-5 py-3 shadow-[0_0_24px_-4px_var(--color-gold)] backdrop-blur"
          >
            <span className="text-3xl" aria-hidden>
              {current.icon}
            </span>
            <div className="min-w-0">
              <div className="text-[0.65rem] font-semibold uppercase tracking-wider text-gold/80">
                Achievement earned
              </div>
              <div className="truncate font-bold text-gold">{current.name}</div>
              <div className="truncate text-sm text-fel-200">
                {current.winners.map((w) => w.characterName).join(", ")}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
