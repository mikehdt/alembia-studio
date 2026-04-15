/** Small text button used in job card action rows. */
export function ActionButton({
  onClick,
  title,
  variant = 'default',
  children,
}: {
  onClick: () => void;
  title: string;
  variant?: 'default' | 'danger';
  children: React.ReactNode;
}) {
  const colour =
    variant === 'danger'
      ? 'text-red-500/70 hover:text-red-500'
      : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex cursor-pointer items-center gap-0.5 rounded px-1.5 py-0.5 text-xs font-medium ${colour}`}
      title={title}
    >
      {children}
    </button>
  );
}
