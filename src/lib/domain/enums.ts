// Domain enums mirroring the Prisma schema enums. Services and components use
// THESE, never the Prisma-generated enums — keeps the persistence layer from
// leaking upward (see implementation-plan §Cross-cutting #3).

export const Role = {
  MEMBER: "MEMBER",
  OFFICER: "OFFICER",
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const MainRole = {
  TANK: "TANK",
  HEALER: "HEALER",
  DPS: "DPS",
} as const;
export type MainRole = (typeof MainRole)[keyof typeof MainRole];

export const Instance = {
  SSC: "SSC",
  TK: "TK",
} as const;
export type Instance = (typeof Instance)[keyof typeof Instance];
