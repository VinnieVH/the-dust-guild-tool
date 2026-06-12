import Link from "next/link";
import type { ReactNode } from "react";
import { PageContainer } from "@/components/ui/page-container";
import { auth, signIn } from "@/lib/auth";

type Hub = {
  href: string;
  title: string;
  body: string;
  // Full static classes (Tailwind v4 JIT cannot see interpolated class roots).
  iconWrap: string;
  icon: ReactNode;
};

const SwordsIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden>
    <path
      d="m14.5 17.5 4-4M3 7l9 9m0 0-2 5-1-1m3-4 5-2-1-1M3 7l-1-4 4 1 11 11"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const TrophyIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden>
    <path d="M6 4h12v4a6 6 0 0 1-12 0V4Z" strokeLinejoin="round" />
    <path
      d="M18 5h2a2 2 0 0 1-2 4M6 5H4a2 2 0 0 0 2 4M9 20h6M12 14v6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const HUB: Hub[] = [
  {
    href: "/raids",
    title: "Raids",
    body: "Upcoming nights, rosters and soft-reserve tracking.",
    iconWrap: "border-fel-600/40 text-fel-400",
    icon: SwordsIcon,
  },
  {
    href: "/leaderboard",
    title: "Leaderboard",
    body: "Season standings and earned achievements.",
    iconWrap: "border-gold/40 text-gold",
    icon: TrophyIcon,
  },
];

export default async function Home() {
  const session = await auth();
  const user = session?.user;

  return (
    <PageContainer>
      {/* Hero */}
      <section className="fel-atmosphere relative mb-10 overflow-hidden rounded-2xl border border-fel-800 px-8 py-14 text-center">
        <p className="mb-3 text-xs font-medium uppercase tracking-[0.35em] text-fel-300">
          The Burning Crusade
        </p>
        <h1 className="fel-glow-text text-5xl font-black tracking-tight text-fel-300 sm:text-6xl">
          The Dust
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-balance text-fel-200">
          Raid signups, soft-reserves and automated achievements — pulled together
          from Raid-Helper, softres.it and Warcraft Logs in one place.
        </p>

        {user ? (
          <p className="mt-6 text-sm text-fel-200">
            Welcome back,{" "}
            <span className="font-semibold text-fel-300">
              {user.discordName ?? user.name}
            </span>
            .
          </p>
        ) : (
          <form
            className="mt-8"
            action={async () => {
              "use server";
              await signIn("discord", { redirectTo: "/" });
            }}
          >
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg border border-fel-600 bg-fel-900/40 px-5 py-2.5 font-semibold text-fel-200 transition-all hover:border-fel-500 hover:text-fel-300 hover:shadow-[0_0_22px_-4px_var(--color-fel-glow)]"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
                <path d="M20.3 4.4A19.8 19.8 0 0 0 15.5 3l-.2.4a14 14 0 0 1 4 1.4 18 18 0 0 0-14.6 0 14 14 0 0 1 4-1.4L8.5 3a19.8 19.8 0 0 0-4.8 1.4C1.5 9 1 13.3 1.2 17.5A20 20 0 0 0 7.3 21l.5-.7a9 9 0 0 1-2-1.2c.2-.1.4-.3.5-.4a14.3 14.3 0 0 0 11.4 0c.2.1.4.3.5.4a9 9 0 0 1-2 1.2l.5.7a20 20 0 0 0 6-3.5c.3-4.8-.4-9-2.9-13.1ZM8.5 15c-1 0-1.7-.9-1.7-2s.8-2 1.7-2 1.7.9 1.7 2-.8 2-1.7 2Zm7 0c-1 0-1.7-.9-1.7-2s.8-2 1.7-2 1.7.9 1.7 2-.8 2-1.7 2Z" />
              </svg>
              Sign in with Discord
            </button>
          </form>
        )}
      </section>

      {/* Hub — only for signed-in members */}
      {user && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {HUB.map((item) => (
            <Link key={item.href} href={item.href} className="group">
              <div className="flex h-full items-start gap-4 rounded-lg border border-fel-800 bg-legion-800 p-5 shadow-[0_0_12px_-2px_var(--color-fel-glow)] transition-all group-hover:border-fel-600 group-hover:shadow-[0_0_20px_-2px_var(--color-fel-glow)]">
                <span
                  className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg border ${item.iconWrap}`}
                >
                  <span className="h-6 w-6">{item.icon}</span>
                </span>
                <div>
                  <h2 className="flex items-center gap-1.5 font-semibold text-fel-300">
                    {item.title}
                    <span className="text-fel-400 opacity-0 transition-all group-hover:translate-x-1 group-hover:opacity-100">
                      →
                    </span>
                  </h2>
                  <p className="mt-1 text-sm text-fel-200">{item.body}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
