import type {
  ExternalRaidEvent,
  ExternalReport,
  ExternalReservation,
  ExternalSignup,
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
