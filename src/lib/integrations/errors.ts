// Typed error all integration adapters throw (cross-cutting req §5). Cron
// handlers catch it, log it, and return a safe 500 — never a raw stack trace.
export class IntegrationError extends Error {
  constructor(
    readonly source: "raid-helper" | "softres" | "warcraftlogs",
    message: string,
    readonly cause?: unknown,
  ) {
    super(`[${source}] ${message}`);
    this.name = "IntegrationError";
  }
}
