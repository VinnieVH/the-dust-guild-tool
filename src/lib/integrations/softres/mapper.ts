import type { ExternalReservation } from "@/lib/domain/external";
import type { SoftresRaidDto, SoftresReserveDto } from "./dto";

// softres returns "0" (the placeholder Discord id) when a reserve has no real
// Discord account attached. Treat that as absent so resolution falls back to
// name matching rather than linking everyone to a single bogus user.
function cleanDiscordId(dId: string | undefined): string | null {
  if (!dId || dId === "0") return null;
  return dId;
}

export function mapReservation(dto: SoftresReserveDto): ExternalReservation {
  return {
    rawName: dto.name,
    rawClass: dto.class || null,
    discordId: cleanDiscordId(dto.dId),
    items: dto.items ?? [],
    // `updated` is the last edit; falls back to `created`. softres timestamps
    // are ISO strings — invalid/missing ones become null, never an Invalid Date.
    reservedAt: parseDate(dto.updated ?? dto.created),
  };
}

function parseDate(value: string | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function mapReservations(dto: SoftresRaidDto): ExternalReservation[] {
  return (dto.reserved ?? []).map(mapReservation);
}
