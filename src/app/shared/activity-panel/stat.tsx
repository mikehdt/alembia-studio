import type { ReactNode } from 'react';

/**
 * A single labelled figure in a job detail view's stats grid. Renders nothing
 * for a null value, so callers can list every stat a job type might have and
 * let the absent ones fall away.
 */
export function Stat({ label, value }: { label: string; value: ReactNode }) {
  if (value == null) return null;
  return (
    <div className="rounded border border-slate-200 bg-slate-50 px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-800/60">
      <div className="text-xs text-slate-400 uppercase">{label}</div>
      <div className="mt-0.5 text-sm font-medium text-(--foreground) tabular-nums">
        {value}
      </div>
    </div>
  );
}
