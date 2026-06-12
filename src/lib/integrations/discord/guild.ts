import { env } from "@/lib/env.server";

// The guild's display identity for the site header (name + icon).
export interface GuildIdentity {
  name: string;
  /** Full CDN icon URL, or null when the guild has no custom icon. */
  iconUrl: string | null;
}

// Raw shape of the fields we read from Discord's GET /guilds/{id} response.
interface DiscordGuildDto {
  name: string;
  icon: string | null;
}

// Build the guild icon CDN url. Animated icons use an `a_` hash prefix and must
// be served as `.gif` (mirrors discord-avatar.ts). Null hash -> no custom icon.
function guildIconUrl(guildId: string, icon: string | null): string | null {
  if (!icon) return null;
  const ext = icon.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/icons/${guildId}/${icon}.${ext}`;
}

// Fetch the guild's name + icon from Discord. Display-only chrome, so this is
// deliberately NON-throwing: any failure (no token, no server id, bot not in the
// guild, network error, bad response) resolves to null and the header falls back
// to its static brand. Never let header chrome break a page render.
//
// Cached hard so the header doesn't hit Discord per render. The guild identity
// changes ~never, and SiteHeader runs on every page; `force-cache` + 24h
// `revalidate` pins THIS fetch to Next's server-side cache for a day, so it's one
// real call per day at most — honouring the "UI doesn't hammer external APIs per
// request" rule (plan §0.5). `force-cache` is explicit (not just `revalidate`)
// because SiteHeader also calls `auth()` (a request-time API), which would
// otherwise mark the route dynamic and defeat time-based fetch caching. Confirmed
// against the Next 16 fetch API docs: `force-cache` + a `revalidate` TTL is the
// canonical cached-with-lifetime combo (only `no-store` + `revalidate` conflicts);
// no `cacheComponents` flag needed.
export async function fetchGuildIdentity(): Promise<GuildIdentity | null> {
  const token = env.DISCORD_BOT_TOKEN;
  const guildId = env.RAID_HELPER_SERVER_ID;
  if (!token || !guildId) return null;

  try {
    const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}`, {
      headers: { Authorization: `Bot ${token}` },
      cache: "force-cache",
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;

    const dto = (await res.json()) as DiscordGuildDto;
    if (!dto.name) return null;

    return { name: dto.name, iconUrl: guildIconUrl(guildId, dto.icon) };
  } catch {
    return null;
  }
}
