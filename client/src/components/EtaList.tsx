import { EtaStopLine } from "./EtaStopLine";
import type { Eta } from "../types/bus";

export function EtaList({
  etas,
  boardingStopId,
  yourStopLabel = "(your stop)",
}: {
  etas: Eta[];
  boardingStopId: string | null;
  /** Shown next to the boarding stop (e.g. parent view). */
  yourStopLabel?: string;
}): React.ReactElement {
  const maxDist = Math.max(...etas.map((e) => e.distanceMeters), 1);
  return (
    <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-600 p-4 shadow-sm">
      <h2 className="font-medium text-slate-800 dark:text-slate-100 mb-3">ETA to stops</h2>
      <ul className="divide-y divide-slate-100 dark:divide-slate-700">
        {etas.map((e) => {
          const mine = boardingStopId === e.stopId;
          const proximity = maxDist > 0 ? Math.max(5, 100 - (e.distanceMeters / maxDist) * 100) : 50;
          return (
            <li
              key={e.stopId}
              className={`py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm ${
                mine ? "bg-emerald-50 dark:bg-emerald-900/20 -mx-4 px-4 rounded-lg" : ""
              }`}
            >
              <div className="min-w-0 flex-1">
                <span className="text-slate-800 dark:text-slate-100">
                  {e.name}
                  {mine && (
                    <span className="ml-2 text-xs font-medium text-emerald-800 dark:text-emerald-300">
                      {yourStopLabel}
                    </span>
                  )}
                </span>
                <div className="mt-1.5 h-1.5 rounded-full bg-slate-200 dark:bg-slate-600 overflow-hidden max-w-xs">
                  <div
                    className="h-full rounded-full bg-brand-500 transition-all duration-300"
                    style={{ width: `${proximity}%` }}
                    title="Relative distance along route (closer to bus = fuller bar)"
                  />
                </div>
              </div>
              <EtaStopLine eta={e} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
