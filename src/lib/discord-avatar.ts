// Build a Discord CDN avatar URL from the OAuth profile.
// - Animated avatars use an `a_` hash prefix and must be served as `.gif`.
// - Users with no custom avatar fall back to Discord's default embed avatar.
//   Modern (non-migrated) accounts have discriminator "0"; the default index is
//   then derived from the user id, otherwise from the legacy discriminator.
export interface DiscordAvatarProfile {
  id: string;
  avatar?: string | null;
  discriminator?: string | null;
}

export function discordAvatarUrl(profile: DiscordAvatarProfile): string {
  if (profile.avatar) {
    const ext = profile.avatar.startsWith("a_") ? "gif" : "png";
    return `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.${ext}`;
  }

  const disc = profile.discriminator ?? "0";
  const index =
    disc === "0"
      ? Number((BigInt(profile.id) >> BigInt(22)) % BigInt(6))
      : Number(disc) % 5;
  return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}
