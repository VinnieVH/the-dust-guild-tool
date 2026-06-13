// Officer action: dismiss WCL performance names that are NOT guild members
// (pugs from before the 25-man roster existed). Dismiss is DISPLAY-ONLY — it
// adds the name to the IgnoredWclName list so the unmatched queue + badge hide
// it. The performance rows are left untouched (never scored anyway), and the
// list survives re-syncs because it keys on rawName. Pure over an injected
// store (no Prisma here).

export interface IgnoreWclNameStore {
  /** Add a name to the ignore list (idempotent by rawName). */
  ignoreName(rawName: string): Promise<void>;
  /** Every currently-unmatched, NOT-yet-ignored rawName (for "dismiss all"). */
  listUnmatchedNotIgnored(): Promise<string[]>;
  /** Add many names to the ignore list at once (idempotent). */
  ignoreNames(rawNames: string[]): Promise<void>;
  /** Remove a name from the ignore list (e.g. when it gets linked after all). */
  unignoreName(rawName: string): Promise<void>;
}

/** Dismiss one unmatched WCL name. */
export async function ignoreWclName(
  store: IgnoreWclNameStore,
  rawName: string,
): Promise<{ ok: true }> {
  await store.ignoreName(rawName);
  return { ok: true };
}

/** Dismiss every currently-unmatched WCL name in one go (clears the backlog). */
export async function ignoreAllUnmatchedWclNames(
  store: IgnoreWclNameStore,
): Promise<{ ok: true; dismissed: number }> {
  const names = await store.listUnmatchedNotIgnored();
  if (names.length > 0) await store.ignoreNames(names);
  return { ok: true, dismissed: names.length };
}
