import { ClassName } from "@/components/ui/class-name";
import { PageContainer } from "@/components/ui/page-container";
import { characterRepository } from "@/lib/repositories/character-repository";
import { auth } from "@/lib/auth";

export default async function ProfilePage() {
  const session = await auth();
  // The proxy already gates this route; this guard is just for types.
  if (!session?.user?.id) return null;

  const characters = await characterRepository.listByUser(session.user.id);

  return (
    <PageContainer>
      <section>
        <h1 className="text-xl font-semibold text-fel-300">My characters</h1>
        {characters.length === 0 ? (
          <div className="mt-2 text-fel-200">
            <p>No characters linked yet.</p>
            <p className="mt-1 text-sm">
              Characters are linked automatically from your Raid-Helper signups
              when you log in. If one is missing — an alt you haven&apos;t signed
              up with, or a role-only signup — ask an officer to link it.
            </p>
          </div>
        ) : (
          <ul className="mt-3 flex flex-col gap-1">
            {characters.map((c) => (
              <li key={c.id}>
                <ClassName name={c.name} wowClass={c.class} />{" "}
                <span className="text-fel-200">
                  — {c.spec} {c.class} ({c.mainRole})
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageContainer>
  );
}
