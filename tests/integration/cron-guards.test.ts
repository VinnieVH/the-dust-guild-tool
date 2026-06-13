import { describe, expect, it } from "vitest";
import { GET as syncGuild } from "@/app/api/cron/sync-guild/route";
import { GET as syncRaidHelper } from "@/app/api/cron/sync-raid-helper/route";
import { GET as syncSoftres } from "@/app/api/cron/sync-softres/route";
import { env } from "@/lib/env.server";

// Wiring guards for the cron routes. The bearer-token check itself is unit-
// tested (cron-auth.test.ts); these prove each ROUTE HANDLER actually calls it —
// a handler that forgot the guard would pass the pure test but fail here.
//
// We import the handlers and invoke them as plain functions (each is
// `export const GET = run`). The 401 path short-circuits on the first line
// before any DB/network IO, so the unauthorized cases touch nothing external.
// We deliberately do NOT drive the valid-bearer path to completion (it runs the
// real sync / hits external APIs — flaky, and covered at the service layer);
// we only assert it gets *past* the guard.

type Handler = (req: Request) => Promise<Response>;

// `probePast`: whether to assert the valid-bearer request gets PAST the guard.
// Only safe for routes with a fast non-network exit right after the guard
// (raid-helper → 503 when unconfigured; softres → DB-only). sync-guild goes
// straight to a live WCL call past the guard, so probing it would hang on the
// network — its guard wiring is still proven by the two unauthorized cases.
const ROUTES: Array<{ name: string; handler: Handler; probePast: boolean }> = [
  { name: "sync-guild", handler: syncGuild, probePast: false },
  { name: "sync-raid-helper", handler: syncRaidHelper, probePast: true },
  { name: "sync-softres", handler: syncSoftres, probePast: true },
];

function req(url: string, auth?: string): Request {
  return new Request(`http://localhost${url}`, {
    headers: auth ? { authorization: auth } : {},
  });
}

describe("cron route guards", () => {
  for (const { name, handler, probePast } of ROUTES) {
    const path = `/api/cron/${name}`;

    it(`${name}: 401 with no authorization header`, async () => {
      const res = await handler(req(path));
      expect(res.status).toBe(401);
    });

    it(`${name}: 401 with a wrong bearer token`, async () => {
      const res = await handler(req(path, "Bearer definitely-not-the-secret"));
      expect(res.status).toBe(401);
    });

    if (probePast) {
      it(`${name}: passes the guard with the configured bearer token`, async () => {
        // CRON_SECRET is required by env validation, so it's always present.
        const res = await handler(req(path, `Bearer ${env.CRON_SECRET}`));
        // Past the guard the handler may 200/503/500 depending on live config —
        // anything but 401 proves the guard let it through (not hardcoded 401).
        expect(res.status).not.toBe(401);
      });
    }
  }
});
