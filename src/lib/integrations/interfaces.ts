import type {
  ExternalGuildAttendance,
  ExternalRaidEvent,
  ExternalReport,
  ExternalReservation,
  ExternalSignup,
  ExternalZoneRanking,
} from "@/lib/domain/external";

// Ports for the three external systems. Adapters (the only code that performs
// external HTTP) implement these and map raw API DTOs -> domain types. The rest
// of the app depends on these interfaces, never on a concrete adapter.

export interface IEventSource {
  fetchUpcomingEvents(): Promise<ExternalRaidEvent[]>;
  fetchSignups(eventId: string): Promise<ExternalSignup[]>;
}

export interface IReserveSource {
  fetchReservations(softresId: string, token?: string): Promise<ExternalReservation[]>;
}

export interface IPerformanceSource {
  fetchReport(reportCode: string): Promise<ExternalReport>;
}

// Guild-level WCL data (not report-scoped): the attendance history that feeds
// per-User streaks, and the live zone rankings shown on the dashboard.
export interface IGuildSource {
  /** Full logged-raid attendance history for the guild (paginated internally). */
  fetchAttendance(guildId: number): Promise<ExternalGuildAttendance[]>;
  /** Current world/region/server speed + progress ranks for one zone. */
  fetchZoneRanking(guildId: number, zoneId: number): Promise<ExternalZoneRanking>;
}
