import type { ReactElement } from "react";
import type { Eta } from "../types/bus";

/** Single line of ETA text for one stop (shared student + parent views). */
export function EtaStopLine({ eta }: { eta: Eta }): ReactElement {
  if (eta.relativeToBus === "passed") {
    return (
      <span className="text-amber-800 dark:text-amber-300 font-medium tabular-nums">
        Bus passed this stop
      </span>
    );
  }
  if (eta.relativeToBus === "approaching") {
    return (
      <span className="text-slate-600 dark:text-slate-400 tabular-nums">
        <span className="text-emerald-700 dark:text-emerald-400 font-medium">Approaching</span>
        <span className="mx-1.5 text-slate-400 dark:text-slate-500">·</span>
        {eta.etaMinutes} min · {eta.distanceMeters} m
      </span>
    );
  }
  return (
    <span className="text-slate-600 dark:text-slate-400 tabular-nums">
      {eta.etaMinutes} min · {eta.distanceMeters} m
    </span>
  );
}
