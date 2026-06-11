"use client";

import { useActionState, useState } from "react";
import { MainRole } from "@/lib/domain/enums";
import { CLASS_SPECS, WOW_CLASSES } from "@/lib/domain/wow";
import { type ClaimActionState, claimCharacterAction } from "./actions";

const initial: ClaimActionState = {};

export function ClaimForm() {
  const [state, action, pending] = useActionState(claimCharacterAction, initial);
  const [wowClass, setWowClass] = useState(WOW_CLASSES[0]);
  const specs = CLASS_SPECS[wowClass] ?? [];

  return (
    <form action={action} className="flex flex-col gap-3 max-w-sm">
      <label className="flex flex-col gap-1 text-sm">
        Name
        <input
          name="name"
          required
          minLength={2}
          maxLength={24}
          className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Class
        <select
          name="class"
          value={wowClass}
          onChange={(e) => setWowClass(e.target.value)}
          className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1"
        >
          {WOW_CLASSES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Spec
        <select
          name="spec"
          className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1"
        >
          {specs.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Main role
        <select
          name="mainRole"
          className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1"
        >
          {Object.values(MainRole).map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </label>

      <button
        type="submit"
        disabled={pending}
        className="rounded border border-neutral-700 px-3 py-1 disabled:opacity-50"
      >
        {pending ? "Claiming…" : "Claim character"}
      </button>

      {state.error && <p className="text-sm text-red-400">{state.error}</p>}
      {state.success && <p className="text-sm text-green-400">{state.success}</p>}
    </form>
  );
}
