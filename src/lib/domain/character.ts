import type { MainRole } from "@/lib/domain/enums";

// Domain view of a character — no Prisma types leak above the repository.
export interface CharacterRecord {
  id: string;
  userId: string | null;
  name: string;
  class: string;
  spec: string;
  mainRole: MainRole;
}

export interface ClaimInput {
  name: string;
  class: string;
  spec: string;
  mainRole: MainRole;
}
