// Pure bearer-token check for /api/cron/* routes. Extracted so the guard is
// unit-testable without booting a route handler.
export function isAuthorizedCron(
  authHeader: string | null,
  secret: string | undefined,
): boolean {
  if (!secret) return false; // never allow when no secret is configured
  return authHeader === `Bearer ${secret}`;
}
