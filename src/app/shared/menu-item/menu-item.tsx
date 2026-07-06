type MenuItemProps = {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
};

/**
 * A single row in a dropdown menu (`Popup`): fixed-width icon slot + label.
 * Shared by the global menu and the per-view project menus.
 */
export const MenuItem = ({ icon, label, onClick, disabled }: MenuItemProps) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
      disabled
        ? 'cursor-not-allowed text-slate-300 dark:text-slate-500'
        : 'cursor-pointer text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
    }`}
  >
    <span className="h-5 w-5">{icon}</span>
    {label}
  </button>
);
