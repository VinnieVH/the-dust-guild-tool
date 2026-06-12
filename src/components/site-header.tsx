import Link from "next/link";
import { auth, signIn, signOut } from "@/lib/auth";
import { Role } from "@/lib/domain/enums";
import { fetchGuildIdentity } from "@/lib/integrations/discord/guild";

// The fel-green shield, used as the brand mark when the guild has no Discord
// icon (or the lookup is unconfigured/unavailable).
const FelShield = (
  <span className="grid h-6 w-6 place-items-center rounded-md border border-fel-700 text-fel-400 shadow-[0_0_10px_-3px_var(--color-fel-glow)] transition-shadow group-hover:shadow-[0_0_14px_-2px_var(--color-fel-glow)]">
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
      <path d="M12 2 4 7v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V7l-8-5Z" />
    </svg>
  </span>
);

// Server component: shows the signed-in Discord name + sign-out, or a sign-in
// button. Officers also see an Admin link. The brand shows the guild's real
// Discord name + icon when configured (falls back to "The Dust" + fel shield).
export async function SiteHeader() {
  const session = await auth();
  const user = session?.user;
  // Non-throwing + cached: null when unconfigured/unavailable -> static brand.
  const guild = await fetchGuildIdentity();

  const navLink =
    "text-fel-200 transition-colors hover:text-fel-400";
  const button =
    "rounded border border-fel-800 px-3 py-1 text-fel-200 transition-colors hover:border-fel-500 hover:text-fel-400 hover:shadow-[0_0_10px_-2px_var(--color-fel-glow)]";

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-legion-700 bg-legion-900/80 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-legion-900/60">
      <nav className="flex items-center gap-4 text-sm">
        <Link
          href="/"
          className="group flex items-center gap-2 font-semibold text-fel-300 hover:text-fel-400"
        >
          {guild?.iconUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={guild.iconUrl}
              alt=""
              width={24}
              height={24}
              className="h-6 w-6 rounded-md border border-fel-700 shadow-[0_0_10px_-3px_var(--color-fel-glow)] transition-shadow group-hover:shadow-[0_0_14px_-2px_var(--color-fel-glow)]"
            />
          ) : (
            FelShield
          )}
          {guild?.name ?? "The Dust"}
        </Link>
        {user && (
          <>
            <Link href="/raids" className={navLink}>
              Raids
            </Link>
            <Link href="/leaderboard" className={navLink}>
              Leaderboard
            </Link>
            {user.role === Role.OFFICER && (
              <Link href="/admin/raid-nights" className={navLink}>
                Admin
              </Link>
            )}
          </>
        )}
      </nav>

      <div className="flex items-center gap-3 text-sm">
        {user ? (
          <>
            <span className="flex items-center gap-2 text-fel-100">
              {user.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.image}
                  alt=""
                  width={28}
                  height={28}
                  className="rounded-full border border-fel-800"
                />
              )}
              {user.discordName ?? user.name}
            </span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <button type="submit" className={button}>
                Sign out
              </button>
            </form>
          </>
        ) : (
          <form
            action={async () => {
              "use server";
              await signIn("discord", { redirectTo: "/" });
            }}
          >
            <button type="submit" className={button}>
              Sign in with Discord
            </button>
          </form>
        )}
      </div>
    </header>
  );
}
