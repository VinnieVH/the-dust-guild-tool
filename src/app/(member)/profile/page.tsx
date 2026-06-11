import { classColor } from "@/lib/domain/wow";
import { characterRepository } from "@/lib/repositories/character-repository";
import { auth } from "@/lib/auth";
import { ClaimForm } from "./claim-form";

export default async function ProfilePage() {
  const session = await auth();
  // The proxy already gates this route; this guard is just for types.
  if (!session?.user?.id) return null;

  const characters = await characterRepository.listByUser(session.user.id);

  return (
    <div className="flex flex-col gap-8 p-6">
      <section>
        <h1 className="text-xl font-semibold">My characters</h1>
        {characters.length === 0 ? (
          <p className="text-neutral-400">
            No characters claimed yet. Claim one below.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-1">
            {characters.map((c) => (
              <li key={c.id}>
                <span style={{ color: classColor(c.class) }} className="font-medium">
                  {c.name}
                </span>{" "}
                <span className="text-neutral-400">
                  — {c.spec} {c.class} ({c.mainRole})
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Claim a character</h2>
        <ClaimForm />
      </section>
    </div>
  );
}
