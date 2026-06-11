"use client";

import { useState } from "react";

// Copies the prebuilt Discord reminder text to the clipboard. The text is built
// server-side (buildReminderText) and passed in, so this stays a thin client.
export function CopyReminderButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="rounded border border-fel-700 px-3 py-1 text-sm text-fel-100 hover:bg-fel-900"
    >
      {copied ? "Copied!" : "Copy Discord reminder"}
    </button>
  );
}
