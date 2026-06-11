import { ClassName } from "@/components/ui/class-name";
import { PageContainer } from "@/components/ui/page-container";
import { characterRepository } from "@/lib/repositories/character-repository";
import { auth } from "@/lib/auth";
import { ClaimForm } from "./claim-form";

export default async function ProfilePage() {
  const session = await auth();
  // The proxy already gates this route; this guard is just for types.
  if (!session?.user?.id) return null;

  const characters = await characterRepository.listByUser(session.user.id);

  return (
    <PageContainer>
      <section className="mb-8">
        <h1 className="text-xl font-semibold text-fel-300">My characters</h1>
        {characters.length === 0 ? (
          <p className="mt-2 text-fel-200">No characters claimed yet. Claim one below.</p>
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

      <section>
        <h2 className="mb-3 text-lg font-semibold text-fel-300">Claim a character</h2>
        <ClaimForm />
      </section>
    </PageContainer>
  );
}
