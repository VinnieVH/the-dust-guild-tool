// Raw Raid-Helper API v4 shapes (https://raid-helper.xyz/api/v4). These stay
// inside the adapter; the mapper converts them to domain types. Shapes are
// derived from recorded fixtures in tests/fixtures/raid-helper/.

// GET /api/v4/servers/{serverId}/events
export interface RhEventsListDto {
  pages: number;
  eventsOverall: number;
  eventsTransmitted: number;
  currentPage: number;
  postedEvents: RhEventSummaryDto[];
}

export interface RhEventSummaryDto {
  id: string;
  title: string;
  /** Unix seconds. */
  startTime: number;
  signUpCount: string;
  channelId: string;
  scheduledId: string;
}

// GET /api/v4/events/{eventId}
export interface RhEventDetailDto {
  id?: string;
  title: string;
  /** Unix seconds. */
  startTime: number;
  signUps: RhSignupDto[];
}

// A non-attending signup (Absence/Bench/Tentative) omits spec/role fields,
// so everything except identity + className is optional.
export interface RhSignupDto {
  userId: string;
  name: string;
  /** Real WoW class, a role marker ("Tank"), or an attendance pseudo-class
   *  ("Absence" | "Bench" | "Tentative" | "Late"). Carries attendance. */
  className: string;
  specName?: string;
  roleName?: string;
  status?: string;
}
