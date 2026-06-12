import type { ReactNode } from "react";

// Centered placeholder for empty/teaser surfaces: an optional fel-ringed icon,
// a title, supporting copy, and optional action(s). Composes with the dark
// fel-glow Card aesthetic so empty pages still feel on-theme rather than bare.
export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-fel-800 bg-legion-800/50 px-6 py-12 text-center">
      {icon && (
        <span className="grid h-12 w-12 place-items-center rounded-full border border-fel-700 text-fel-400 shadow-[0_0_14px_-4px_var(--color-fel-glow)]">
          <span className="h-6 w-6">{icon}</span>
        </span>
      )}
      <h2 className="text-lg font-semibold text-fel-300">{title}</h2>
      {children && <p className="max-w-sm text-sm text-fel-200">{children}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
