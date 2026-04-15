'use client';

type StatusConfig = {
  show: boolean;
  message: string;
};

type TagStatusLegendProps = {
  /** Configuration for "all" status (rose/red) */
  all?: StatusConfig;
  /** Configuration for "some" status (amber/yellow) */
  some?: StatusConfig;
  /** Configuration for "duplicate" status (purple) - used for form-level duplicates */
  duplicate?: StatusConfig;
  /** Additional wrapper className */
  className?: string;
};

/**
 * Displays colour-coded legend explanations for tag statuses.
 * Used to explain what different highlight colours mean in tag inputs.
 */
export const TagStatusLegend = ({
  all,
  some,
  duplicate,
  className = '',
}: TagStatusLegendProps) => {
  const hasAnyStatus = all?.show || some?.show || duplicate?.show;

  if (!hasAnyStatus) {
    return null;
  }

  return (
    <div className={`flex flex-wrap gap-2 text-xs text-slate-500 ${className}`}>
      {all?.show && (
        <p className="flex w-full">
          <span className="mt-0.5 mr-2 h-3 min-w-3 rounded-full border border-rose-400 bg-rose-100"></span>
          {all.message}
        </p>
      )}

      {some?.show && (
        <p className="flex w-full">
          <span className="mt-0.5 mr-2 h-3 min-w-3 rounded-full border border-amber-400 bg-amber-50"></span>
          {some.message}
        </p>
      )}

      {duplicate?.show && (
        <p className="flex w-full">
          <span className="mt-0.5 mr-2 h-3 min-w-3 rounded-full border border-purple-400 bg-purple-100"></span>
          {duplicate.message}
        </p>
      )}
    </div>
  );
};
