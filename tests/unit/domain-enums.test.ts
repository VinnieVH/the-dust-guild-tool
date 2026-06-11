import { describe, expect, it } from "vitest";
import {
  Instance as PrismaInstance,
  MainRole as PrismaMainRole,
  Role as PrismaRole,
} from "@/generated/prisma/enums";
import { Instance, MainRole, Role } from "@/lib/domain/enums";

// Guard: domain enums must stay value-identical to the Prisma schema enums.
// If the schema changes an enum, this test fails until the domain mirror is
// updated — preventing silent drift between the two.
describe("domain enums mirror Prisma enums", () => {
  it("Role matches", () => {
    expect(Object.values(Role).sort()).toEqual(Object.values(PrismaRole).sort());
  });
  it("MainRole matches", () => {
    expect(Object.values(MainRole).sort()).toEqual(
      Object.values(PrismaMainRole).sort(),
    );
  });
  it("Instance matches", () => {
    expect(Object.values(Instance).sort()).toEqual(
      Object.values(PrismaInstance).sort(),
    );
  });

  // Type-level assignability check (compile-time): a domain value must be a
  // valid Prisma value and vice versa.
  it("are mutually assignable at the type level", () => {
    const r: PrismaRole = Role.OFFICER;
    const r2: Role = PrismaRole.MEMBER;
    const m: PrismaMainRole = MainRole.TANK;
    const i: PrismaInstance = Instance.SSC;
    expect([r, r2, m, i]).toBeDefined();
  });
});
