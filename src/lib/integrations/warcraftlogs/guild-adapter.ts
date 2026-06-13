import type {
  ExternalCompositionMember,
  ExternalGuildAttendance,
  ExternalZoneRanking,
} from "@/lib/domain/external";
import { MainRole } from "@/lib/domain/enums";
import { IntegrationError } from "@/lib/integrations/errors";
import type { IGuildSource } from "@/lib/integrations/interfaces";
import type { WclCredentials } from "./auth";
import { WclClient, type WclQuerier } from "./client";
import type {
  WclGuildAttendance,
  WclGuildZoneRanking,
  WclPlayerDetail,
  WclReportComposition,
} from "./dto";
import {
  GUILD_ATTENDANCE,
  GUILD_ZONE_RANKING,
  REPORT_COMPOSITION,
} from "./queries";

// The dominant played spec = the one with the most sampled fights.
function dominantSpec(specs: WclPlayerDetail["specs"]): string {
  if (!specs || specs.length === 0) return "";
  return [...specs].sort((a, b) => b.count - a.count)[0].spec;
}

// Total sampled fights for an entry — used to pick a character's PRIMARY role
// when WCL lists them in more than one (e.g. an off-spec tank also DPS'd).
function fightWeight(specs: WclPlayerDetail["specs"]): number {
  return (specs ?? []).reduce((n, s) => n + s.count, 0);
}

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

  async fetchComposition(reportCode: string): Promise<ExternalCompositionMember[]> {
    // playerDetails needs a time window; pass the report's full range. WCL caps
    // at the report bounds, so a 0..far-future window returns the whole report.
    const res = await this.client.query<WclReportComposition>(REPORT_COMPOSITION, {
      code: reportCode,
      startTime: 0,
      endTime: 9_999_999_999_999,
    });
    const data = res.reportData.report?.playerDetails?.data?.playerDetails;
    if (!data) {
      throw new IntegrationError(
        "warcraftlogs",
        `report ${reportCode} composition not found`,
      );
    }

    const map = (group: WclPlayerDetail[] | undefined, role: MainRole) =>
      (group ?? []).map((p) => ({
        member: {
          name: p.name,
          role,
          className: p.type,
          spec: dominantSpec(p.specs),
          maxItemLevel: p.maxItemLevel,
        },
        weight: fightWeight(p.specs),
      }));

    // A character can appear in MORE THAN ONE role group (an off-spec tank who
    // also DPS'd). Collapse to one entry per name, keeping the role they played
    // most (highest fight weight) — matches how WCL's panel slots a player.
    const byName = new Map<string, { member: ExternalCompositionMember; weight: number }>();
    for (const e of [
      ...map(data.tanks, MainRole.TANK),
      ...map(data.healers, MainRole.HEALER),
      ...map(data.dps, MainRole.DPS),
    ]) {
      const existing = byName.get(e.member.name);
      if (!existing || e.weight > existing.weight) byName.set(e.member.name, e);
    }

    return [...byName.values()].map((e) => e.member);
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
