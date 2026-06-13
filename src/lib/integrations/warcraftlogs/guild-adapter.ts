import type {
  ExternalGuildAttendance,
  ExternalGuildMember,
  ExternalZoneRanking,
} from "@/lib/domain/external";
import { wclClassName } from "@/lib/domain/wow";
import { IntegrationError } from "@/lib/integrations/errors";
import type { IGuildSource } from "@/lib/integrations/interfaces";
import type { WclCredentials } from "./auth";
import { WclClient, type WclQuerier } from "./client";
import type {
  WclGuildAttendance,
  WclGuildMembers,
  WclGuildZoneRanking,
} from "./dto";
import { GUILD_ATTENDANCE, GUILD_MEMBERS, GUILD_ZONE_RANKING } from "./queries";

// Guild-level WCL adapter (IGuildSource): attendance history (paged) + live
// zone rankings. Separate from WarcraftLogsAdapter (report-scoped) to keep each
// port focused. `client` injectable for tests.

export class WarcraftLogsGuildAdapter implements IGuildSource {
  private readonly client: WclQuerier;

  constructor(creds: WclCredentials, client?: WclQuerier) {
    this.client = client ?? new WclClient(creds);
  }

  async fetchAttendance(guildId: number): Promise<ExternalGuildAttendance[]> {
    const out: ExternalGuildAttendance[] = [];
    let page = 1;
    // Bounded defensively; 49 nights at ~16/page is ~4 pages.
    for (let guard = 0; guard < 200; guard++) {
      const res = await this.client.query<WclGuildAttendance>(GUILD_ATTENDANCE, {
        guildId,
        page,
      });
      const att = res.guildData.guild?.attendance;
      if (!att) {
        throw new IntegrationError(
          "warcraftlogs",
          `guild ${guildId} attendance not found`,
        );
      }
      for (const night of att.data) {
        out.push({
          reportCode: night.code,
          startTime: new Date(night.startTime),
          zone: night.zone?.name ?? "Unknown",
          players: night.players.map((p) => ({
            name: p.name,
            // presence 1 = present, 2 = partial; both count as "was there".
            present: p.presence >= 1,
          })),
        });
      }
      if (!att.has_more_pages) break;
      page += 1;
    }
    return out;
  }

  async fetchRoster(guildId: number): Promise<ExternalGuildMember[]> {
    const out: ExternalGuildMember[] = [];
    let page = 1;
    // Bounded defensively; 41 members at the default page size is ~1-2 pages.
    for (let guard = 0; guard < 200; guard++) {
      const res = await this.client.query<WclGuildMembers>(GUILD_MEMBERS, {
        guildId,
        page,
      });
      const members = res.guildData.guild?.members;
      if (!members) {
        throw new IntegrationError(
          "warcraftlogs",
          `guild ${guildId} roster not found`,
        );
      }
      for (const m of members.data) {
        out.push({
          name: m.name,
          className: wclClassName(m.classID),
          level: m.level,
        });
      }
      if (!members.has_more_pages) break;
      page += 1;
    }
    return out;
  }

  async fetchZoneRanking(
    guildId: number,
    zoneId: number,
  ): Promise<ExternalZoneRanking> {
    const res = await this.client.query<WclGuildZoneRanking>(GUILD_ZONE_RANKING, {
      guildId,
      zoneId,
    });
    const guild = res.guildData.guild;
    if (!guild) {
      throw new IntegrationError("warcraftlogs", `guild ${guildId} not found`);
    }
    const zr = guild.zoneRanking;
    const speed = zr?.speed ?? null;
    const prog = zr?.progress ?? null;
    return {
      zoneId,
      // The ranking response doesn't echo the zone name; caller supplies it.
      zoneName: "",
      speedWorldRank: speed?.worldRank.number ?? null,
      speedRegionRank: speed?.regionRank.number ?? null,
      speedServerRank: speed?.serverRank.number ?? null,
      speedColor: speed?.worldRank.color ?? null,
      progWorldRank: prog?.worldRank.number ?? null,
      progRegionRank: prog?.regionRank.number ?? null,
      progServerRank: prog?.serverRank.number ?? null,
    };
  }
}
