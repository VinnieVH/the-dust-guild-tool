import type { ExternalReservation } from "@/lib/domain/external";
import { IntegrationError } from "@/lib/integrations/errors";
import type { IReserveSource } from "@/lib/integrations/interfaces";
import type { SoftresRaidDto } from "./dto";
import { mapReservations } from "./mapper";

const BASE_URL = "https://softres.it/api";

// Adapter for the softres.it API. The only place softres HTTP happens. The read
// endpoint is public (no token needed) — `token` is accepted for parity with the
// IReserveSource port and future write/locked-sheet support, but unused here.
export class SoftresAdapter implements IReserveSource {
  // `token` (from IReserveSource) is unused: the read endpoint is public. Kept
  // out of the signature body rather than named-and-ignored to satisfy lint.
  async fetchReservations(softresId: string): Promise<ExternalReservation[]> {
    let res: Response;
    try {
      res = await fetch(`${BASE_URL}/raid/${softresId}`);
    } catch (cause) {
      throw new IntegrationError(
        "softres",
        `request for raid ${softresId} failed`,
        cause,
      );
    }
    if (!res.ok) {
      throw new IntegrationError(
        "softres",
        `GET /raid/${softresId} returned ${res.status}`,
      );
    }
    const data = (await res.json()) as SoftresRaidDto;
    return mapReservations(data);
  }
}

// Parse a softres id out of whatever an officer pastes: a full raid URL, an
// edit/import URL, or a bare id. Returns null when no plausible id is found.
//
//   https://softres.it/raid/pfsymj        -> "pfsymj"
//   https://softres.it/raid/pfsymj/edit    -> "pfsymj"
//   softres.it/raid/pfsymj                 -> "pfsymj"
//   pfsymj                                 -> "pfsymj"
export function parseSoftresUrl(input: string): { softresId: string } | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/(?:softres\.it\/raid\/)([A-Za-z0-9]+)/);
  if (match) return { softresId: match[1] };

  // Bare id: alphanumeric, no slashes/spaces, and not a stray URL fragment.
  if (/^[A-Za-z0-9]+$/.test(trimmed)) return { softresId: trimmed };

  return null;
}
