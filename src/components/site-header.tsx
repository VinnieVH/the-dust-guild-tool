import Link from "next/link";
import { auth, signIn, signOut } from "@/lib/auth";
import { Role } from "@/lib/domain/enums";

// Server component: shows the signed-in Discord name + sign-out, or a sign-in
// button. Officers also see an Admin link.
export async function SiteHeader() {
  const session = await auth();
  const user = session?.user;

  return (
    <header className="flex items-center justify-between border-b border-neutral-800 px-6 py-3">
      <nav className="flex items-center gap-4 text-sm">
        <Link href="/" className="font-semibold">
          The Dust
        </Link>
        {user && (
          <>
            <Link href="/raids">Raids</Link>
            <Link href="/profile">Profile</Link>
            <Link href="/leaderboard">Leaderboard</Link>
            {user.role === Role.OFFICER && (
              <Link href="/admin/raid-nights">Admin</Link>
            )}
          </>
        )}
      </nav>

      <div className="flex items-center gap-3 text-sm">
        {user ? (
          <>
            <span className="text-neutral-300">{user.discordName ?? user.name}</span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <button type="submit" className="rounded border border-neutral-700 px-3 py-1">
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
            <button type="submit" className="rounded border border-neutral-700 px-3 py-1">
              Sign in with Discord
            </button>
          </form>
        )}
      </div>
    </header>
  );
}
