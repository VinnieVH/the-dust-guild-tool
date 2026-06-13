// Tunable thresholds for the scoring + achievement engine, in ONE place so the
// seed, the rules, and the UI never drift. See docs/achievement-design.md for
// the rationale behind each number.

/** Share of a night's boss kills a player must be present for to be eligible
 *  for the per-role crowns and Iron Man. Signed off at 75%. */
export const PARTICIPATION_THRESHOLD = 0.75;

/** Floor Inspector (affectionate banter) only fires on a genuine outlier:
 *  the most-deaths player needs at least this many deaths AND at least this
 *  multiple of the runner-up's deaths. Otherwise NO award (a clean/normal
 *  night produces none). Keeps it fun, never a "worst" verdict. */
export const FLOOR_INSPECTOR_MIN_DEATHS = 3;
export const FLOOR_INSPECTOR_OUTLIER_MULTIPLE = 2;

/** Well-Oiled Machine (guild): the night's raid-average parse must clear this
 *  to celebrate a high-execution night collectively. */
export const WELL_OILED_AVG_PARSE = 80;

/** Attendance streak milestones (consecutive logged raids attended, per User).
 *  Crossing one of these awards a kept-forever StreakMilestone. The current
 *  streak itself is a live stat (User.currentStreak), not tied to these. */
export const STREAK_MILESTONES = [5, 10, 20, 30, 50] as const;
