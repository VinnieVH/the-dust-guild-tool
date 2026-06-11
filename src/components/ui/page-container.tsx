import type { ReactNode } from "react";

// Constrains page content to a readable width and centers it, so a sparse page
// (e.g. one raid card) doesn't sit alone against the far-left edge.
export function PageContainer({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-5xl px-6 py-8">{children}</div>;
}
