import Link from "next/link";
import { MobileNav } from "@/components/mobile-nav";
import { auth, signIn, signOut } from "@/lib/auth";
import { Role } from "@/lib/domain/enums";

const navLink = "text-fel-200 transition-colors hover:text-fel-400";
const button =
  "rounded border border-fel-800 px-3 py-1 text-fel-200 transition-colors hover:border-fel-500 hover:text-fel-400 hover:shadow-[0_0_10px_-2px_var(--color-fel-glow)]";

// Server component: shows the signed-in Discord name + sign-out, or a sign-in
// button. Officers also see an Admin link.
//
// Desktop (md+) lays everything out inline as before. On mobile the links and
// the name/sign-out collapse into a hamburger panel (MobileNav) so the bar
// stops overflowing the viewport; only the logo + avatar + hamburger stay in
// the bar. Both layouts render the SAME server-rendered fragments below, just
// hidden/shown per breakpoint — so the inline server actions work either way.
export async function SiteHeader() {
  const session = await auth();
  const user = session?.user;

  const navLinks = user && (
    <>
      <Link href="/raids" className={navLink}>
        Raids
      </Link>
      <Link href="/guild" className={navLink}>
        Guild
      </Link>
      <Link href="/leaderboard" className={navLink}>
        Leaderboard
      </Link>
      <Link href="/profile" className={navLink}>
        Profile
      </Link>
      {user.role === Role.OFFICER && (
        <Link href="/admin/raid-nights" className={navLink}>
          Admin
        </Link>
      )}
    </>
  );

  const signOutForm = (
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
  );

  const signInForm = (
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
  );

  const avatar = user?.image && (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={user.image}
      alt=""
      width={28}
      height={28}
      className="rounded-full border border-fel-800"
    />
  );

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-legion-700 bg-legion-900/80 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-legion-900/60">
      <nav className="flex items-center gap-4 text-sm">
        <Link
          href="/"
          className="group flex items-center gap-2 font-semibold text-fel-300 hover:text-fel-400"
        >
          {/* Server icon — drop a square image at public/server-icon.png. Rounded
              and sized to match the user avatar (28px). */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/server-icon.png"
            alt=""
            width={28}
            height={28}
            className="rounded-full border border-fel-800"
          />
          The Dust
        </Link>
        {/* Inline links — desktop only. */}
        <span className="hidden items-center gap-4 md:flex">{navLinks}</span>
      </nav>

      {/* Desktop auth block — name + sign-out / sign-in inline. */}
      <div className="hidden items-center gap-3 text-sm md:flex">
        {user ? (
          <>
            <span className="flex items-center gap-2 text-fel-100">
              {avatar}
              {user.discordName ?? user.name}
            </span>
            {signOutForm}
          </>
        ) : (
          signInForm
        )}
      </div>

      {/* Mobile: avatar stays in the bar for at-a-glance signed-in state; the
          rest collapses into the hamburger panel. Signed-out users just get the
          sign-in button (nothing to collapse). */}
      <div className="flex items-center gap-3 md:hidden">
        {user ? (
          <>
            {avatar}
            <MobileNav>
              <div className="flex flex-col gap-4 text-sm">
                {navLinks}
                <span className="border-t border-legion-700 pt-4 text-fel-100">
                  {user.discordName ?? user.name}
                </span>
                {signOutForm}
              </div>
            </MobileNav>
          </>
        ) : (
          signInForm
        )}
      </div>
    </header>
  );
}
