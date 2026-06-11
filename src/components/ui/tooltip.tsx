import type { ReactNode } from "react";

// In-game item-tooltip style: dark panel, gold title, thin border. CSS-only
// hover (group), so it works in server components without client JS.
export function Tooltip({
  title,
  children,
  body,
}: {
  title: string;
  children: ReactNode;
  body: ReactNode;
}) {
  return (
    <span className="group relative inline-block">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden w-max max-w-xs -translate-x-1/2 rounded border border-gold/60 bg-legion-950 p-2 text-left text-xs text-fel-100 shadow-lg group-hover:block"
      >
        <span className="mb-1 block font-semibold text-gold">{title}</span>
        {body}
      </span>
    </span>
  );
}
