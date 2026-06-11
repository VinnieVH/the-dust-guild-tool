import { classColor } from "@/lib/domain/wow";

// Renders a character name in its WoW class color.
export function ClassName({
  name,
  wowClass,
  className = "",
}: {
  name: string;
  wowClass: string;
  className?: string;
}) {
  return (
    <span style={{ color: classColor(wowClass) }} className={`font-medium ${className}`}>
      {name}
    </span>
  );
}
