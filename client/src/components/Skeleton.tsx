import type { HTMLAttributes } from "react";

export function Skeleton({ className = "", ...rest }: HTMLAttributes<HTMLDivElement>): React.ReactElement {
  return (
    <div
      className={`animate-pulse rounded-md bg-slate-200 dark:bg-slate-700 ${className}`}
      aria-hidden
      {...rest}
    />
  );
}

export function SkeletonCard(): React.ReactElement {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800/50 p-4 space-y-3">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-4 w-full max-w-md" />
      <Skeleton className="h-[280px] w-full rounded-lg" />
    </div>
  );
}

export function SkeletonTableRow({ cols = 4 }: { cols?: number }): React.ReactElement {
  return (
    <tr className="border-t border-slate-100 dark:border-slate-700">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="p-2">
          <Skeleton className="h-4 w-full max-w-[120px]" />
        </td>
      ))}
    </tr>
  );
}
