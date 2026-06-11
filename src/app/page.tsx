import Link from "next/link";
import { Card } from "@/components/ui/card";
import { PageContainer } from "@/components/ui/page-container";
import { auth, signIn } from "@/lib/auth";

const HUB = [
  { href: "/raids", title: "Raids", body: "Upcoming nights, rosters and signups." },
  { href: "/profile", title: "Profile", body: "Claim your characters and view your trophies." },
  { href: "/leaderboard", title: "Leaderboard", body: "Season standings across the guild." },
];

export default async function Home() {
  const session = await auth();
  const user = session?.user;

  return (
    <PageContainer>
      <section className="mb-8">
        <h1 className="text-3xl font-bold text-fel-300">The Dust</h1>
        <p className="mt-1 max-w-xl text-fel-200">
          Raid signups, soft-reserves and automated achievements for the guild.
        </p>
      </section>

      {user ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {HUB.map((item) => (
            <Link key={item.href} href={item.href}>
              <Card className="h-full transition-shadow hover:shadow-[0_0_18px_-2px_var(--color-fel-glow)]">
                <h2 className="font-semibold text-fel-300">{item.title}</h2>
                <p className="mt-1 text-sm text-fel-200">{item.body}</p>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <p className="mb-3 text-fel-200">Sign in with Discord to get started.</p>
          <form
            action={async () => {
              "use server";
              await signIn("discord", { redirectTo: "/" });
            }}
          >
            <button
              type="submit"
              className="rounded border border-fel-800 px-3 py-1 text-fel-200 transition-colors hover:border-fel-500 hover:text-fel-400 hover:shadow-[0_0_10px_-2px_var(--color-fel-glow)]"
            >
              Sign in with Discord
            </button>
          </form>
        </Card>
      )}
    </PageContainer>
  );
}
