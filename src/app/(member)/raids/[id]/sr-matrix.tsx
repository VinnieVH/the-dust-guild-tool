import { ClassName } from "@/components/ui/class-name";
import type { ReserveOverview } from "@/lib/services/reserve-overview-service";

const Cell = ({ done }: { done: boolean }) =>
  done ? (
    <span className="text-fel-400" aria-label="reserved">
      ✓
    </span>
  ) : (
    <span className="text-red-500" aria-label="missing">
      ✗
    </span>
  );

// The SR matrix: one row per confirmed signup, one column per linked sheet.
export function SrMatrix({ overview }: { overview: ReserveOverview }) {
  const { rows, sheets } = overview;

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-fel-200">
          <th className="py-1">Member</th>
          {sheets.map((s) => (
            <th key={s.sheetId} className="px-2 py-1 text-center">
              {s.name}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.discordId} className="border-t border-fel-900/40">
            <td className="py-1">
              {row.displayClass ? (
                <ClassName name={row.displayName} wowClass={row.displayClass} />
              ) : (
                <span className="text-fel-100">{row.displayName}</span>
              )}
              {!row.hasCharacter && (
                <span className="ml-2 text-xs text-red-400">
                  no character claimed
                </span>
              )}
            </td>
            {sheets.map((s) => (
              <td key={s.sheetId} className="px-2 py-1 text-center">
                <Cell done={row.done[s.sheetId]} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
