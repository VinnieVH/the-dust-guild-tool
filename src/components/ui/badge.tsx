import type { ReactNode } from "react";

type Variant = "fel" | "epic" | "gold" | "neutral";

const VARIANTS: Record<Variant, string> = {
  fel: "border-fel-600 text-fel-200",
  epic: "border-epic text-epic",
  gold: "border-gold text-gold",
  neutral: "border-legion-700 text-fel-100",
};

export function Badge({
  children,
  variant = "neutral",
}: {
  children: ReactNode;
  variant?: Variant;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${VARIANTS[variant]}`}
    >
      {children}
    </span>
  );
}
