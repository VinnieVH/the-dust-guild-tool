import { describe, expect, it } from "vitest";
import { decideGate } from "@/lib/auth-gate";
import { Role } from "@/lib/domain/enums";

const member = { role: Role.MEMBER };
const officer = { role: Role.OFFICER };

describe("decideGate", () => {
  it("allows public routes regardless of session", () => {
    expect(decideGate("/", null)).toEqual({ kind: "allow" });
    expect(decideGate("/styleguide", null)).toEqual({ kind: "allow" });
  });

  it("requires a session for member routes", () => {
    expect(decideGate("/raids", null)).toEqual({ kind: "unauthorized", api: false });
    expect(decideGate("/leaderboard", null)).toEqual({ kind: "unauthorized", api: false });
    expect(decideGate("/guild", null)).toEqual({ kind: "unauthorized", api: false });
    expect(decideGate("/profile", null)).toEqual({ kind: "unauthorized", api: false });
  });

  it("lets any signed-in user into member routes", () => {
    expect(decideGate("/raids", member)).toEqual({ kind: "allow" });
    expect(decideGate("/leaderboard", officer)).toEqual({ kind: "allow" });
  });

  it("forbids a MEMBER from officer routes", () => {
    expect(decideGate("/admin/raid-nights", member)).toEqual({
      kind: "forbidden",
      api: false,
    });
  });

  it("lets an OFFICER into officer routes", () => {
    expect(decideGate("/admin/raid-nights", officer)).toEqual({ kind: "allow" });
  });

  it("unauthenticated officer route -> unauthorized, not forbidden", () => {
    expect(decideGate("/admin/raid-nights", null)).toEqual({
      kind: "unauthorized",
      api: false,
    });
  });

  it("flags API routes so the proxy returns JSON status codes", () => {
    expect(decideGate("/api/admin/sync", null)).toEqual({
      kind: "unauthorized",
      api: true,
    });
    expect(decideGate("/api/admin/sync", member)).toEqual({
      kind: "forbidden",
      api: true,
    });
  });
});
