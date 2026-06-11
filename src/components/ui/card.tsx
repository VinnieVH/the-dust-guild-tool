import type { ReactNode } from "react";

// Dark panel with a subtle fel-green border glow.
export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg border border-fel-800 bg-legion-800 p-4 shadow-[0_0_12px_-2px_var(--color-fel-glow)] ${className}`}
    >
      {children}
    </div>
  );
}
