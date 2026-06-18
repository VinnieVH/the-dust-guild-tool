"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";

// Mobile-only hamburger shell. The nav links + auth block are server-rendered
// in SiteHeader and passed in as `children` — this component only owns the
// open/close state and the slide-down panel, so the inline server actions in
// those children stay valid (they're never imported into this module graph).
//
// SiteHeader lives in the root layout, which persists across client-side
// navigations (it never remounts). So `open` would survive route changes and
// leave the panel covering the next page. We watch usePathname() and close on
// every change to fix that.
export function MobileNav({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close on navigation without an effect: track the pathname the panel was
  // last rendered against and reset `open` during render when it changes. This
  // is React's recommended "adjust state when a prop changes" idiom (cheaper
  // than an effect, no cascading render).
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setOpen(false);
  }

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? "Close menu" : "Open menu"}
        className="flex h-9 w-9 items-center justify-center rounded border border-fel-800 text-fel-200 transition-colors hover:border-fel-500 hover:text-fel-400"
      >
        {/* Hamburger / close glyph drawn with spans so we need no icon dep. */}
        {open ? (
          <span aria-hidden className="text-lg leading-none">
            ✕
          </span>
        ) : (
          <span aria-hidden className="flex flex-col gap-[5px]">
            <span className="block h-0.5 w-5 bg-current" />
            <span className="block h-0.5 w-5 bg-current" />
            <span className="block h-0.5 w-5 bg-current" />
          </span>
        )}
      </button>

      {open && (
        <div className="absolute inset-x-0 top-full border-b border-legion-700 bg-legion-900/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-legion-900/90">
          {children}
        </div>
      )}
    </div>
  );
}
