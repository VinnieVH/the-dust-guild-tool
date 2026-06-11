import type { ExternalRaidEvent, ExternalSignup } from "@/lib/domain/external";
import { IntegrationError } from "@/lib/integrations/errors";
import type { IEventSource } from "@/lib/integrations/interfaces";
import type { RhEventDetailDto, RhEventsListDto } from "./dto";
import { mapEventSummary, mapSignups } from "./mapper";

const BASE_URL = "https://raid-helper.xyz/api/v4";

export interface RaidHelperConfig {
  apiKey: string;
  serverId: string;
}

// Adapter for the Raid-Helper REST API. The only place Raid-Helper HTTP
// happens. Maps raw DTOs -> domain types via the mapper.
export class RaidHelperAdapter implements IEventSource {
  constructor(private readonly config: RaidHelperConfig) {}

  private async get<T>(path: string): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${BASE_URL}${path}`, {
        headers: { Authorization: this.config.apiKey },
      });
    } catch (cause) {
      throw new IntegrationError("raid-helper", `request to ${path} failed`, cause);
    }
    if (!res.ok) {
      throw new IntegrationError(
        "raid-helper",
        `GET ${path} returned ${res.status}`,
      );
    }
    return (await res.json()) as T;
  }

  async fetchUpcomingEvents(): Promise<ExternalRaidEvent[]> {
    const data = await this.get<RhEventsListDto>(
      `/servers/${this.config.serverId}/events`,
    );
    return (data.postedEvents ?? []).map(mapEventSummary);
  }

  async fetchSignups(eventId: string): Promise<ExternalSignup[]> {
    const data = await this.get<RhEventDetailDto>(`/events/${eventId}`);
    return mapSignups(data);
  }
}
