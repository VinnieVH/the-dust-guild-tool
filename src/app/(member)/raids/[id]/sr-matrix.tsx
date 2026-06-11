import { Instance } from "@/lib/domain/enums";
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

// The SR matrix: one row per confirmed signup, a column per linked instance.
export function SrMatrix({ overview }: { overview: ReserveOverview }) {
  const { rows, linkedInstances } = overview;

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-fel-200">
          <th className="py-1">Member</th>
          {linkedInstances.includes(Instance.SSC) && (
            <th className="py-1 text-center">SSC</th>
          )}
          {linkedInstances.includes(Instance.TK) && (
            <th className="py-1 text-center">TK</th>
          )}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.discordId} className="border-t border-fel-900/40">
            <td className="py-1">
              <span className="text-fel-100">{row.displayName}</span>
              {!row.hasCharacter && (
                <span className="ml-2 text-xs text-red-400">
                  no character claimed
                </span>
              )}
            </td>
            {linkedInstances.includes(Instance.SSC) && (
              <td className="py-1 text-center">
                <Cell done={row.ssc} />
              </td>
            )}
            {linkedInstances.includes(Instance.TK) && (
              <td className="py-1 text-center">
                <Cell done={row.tk} />
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
