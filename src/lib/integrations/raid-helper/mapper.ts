import {
  type ExternalRaidEvent,
  type ExternalSignup,
  SignupStatus,
} from "@/lib/domain/external";
import { isValidClass } from "@/lib/domain/wow";
import type {
  RhEventDetailDto,
  RhEventSummaryDto,
  RhSignupDto,
} from "./dto";

// Raid-Helper encodes attendance in `className`, NOT `status` (status stays
// "primary" even for an absence — verified against fixtures). So we key the
// signup status off className.
const ATTENDANCE_BY_CLASS: Record<string, SignupStatus> = {
  Absence: SignupStatus.ABSENT,
  Bench: SignupStatus.BENCH,
  Tentative: SignupStatus.TENTATIVE,
  Late: SignupStatus.CONFIRMED, // showing up, just late
};

export function mapEventSummary(dto: RhEventSummaryDto): ExternalRaidEvent {
  return {
    eventId: dto.id,
    title: dto.title,
    startTime: new Date(dto.startTime * 1000),
  };
}

function mapStatus(className: string): SignupStatus {
  const attendance = ATTENDANCE_BY_CLASS[className];
  if (attendance) return attendance;

  // A real WoW class or a role signup ("Tank") means they're in.
  if (isValidClass(className) || className === "Tank") {
    return SignupStatus.CONFIRMED;
  }

  // Genuinely unknown marker — be conservative, don't assume attendance.
  console.warn(`[raid-helper] unknown signup className "${className}" -> TENTATIVE`);
  return SignupStatus.TENTATIVE;
}

// Raid-Helper disambiguates same-named specs across classes with a trailing
// digit (Holy1, Protection1). That's display-only — strip it.
function cleanSpec(spec: string | undefined): string | null {
  if (!spec) return null;
  return spec.replace(/\d+$/, "");
}

export function mapSignup(dto: RhSignupDto): ExternalSignup {
  return {
    discordId: dto.userId,
    name: dto.name,
    // className is only a class when it's a real WoW class — "Tank"/"Absence"
    // etc. are not classes, so leave class null (matching is by name anyway).
    class: isValidClass(dto.className) ? dto.className : null,
    spec: cleanSpec(dto.specName),
    status: mapStatus(dto.className),
  };
}

export function mapSignups(dto: RhEventDetailDto): ExternalSignup[] {
  return (dto.signUps ?? []).map(mapSignup);
}
