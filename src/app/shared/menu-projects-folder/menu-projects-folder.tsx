import { FolderOpenIcon } from 'lucide-react';
import { memo, useCallback, useState } from 'react';

type MenuProjectsFolderProps = {
  folder: string;
  onSave: (folder: string) => Promise<{ error?: string }>;
};

const MenuProjectsFolderComponent = ({
  folder,
  onSave,
}: MenuProjectsFolderProps) => {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleBrowse = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      setError(null);

      try {
        const params = new URLSearchParams({
          title: 'Select projects folder',
          mode: 'folder',
        });
        const res = await fetch(`/api/filesystem/browse?${params}`);
        const data = await res.json();

        if (data.cancelled || !data.path) return;

        setSaving(true);
        const result = await onSave(data.path);
        setSaving(false);

        if (result.error) {
          setError(result.error);
        }
      } catch {
        setSaving(false);
        setError('Failed to open folder picker');
      }
    },
    [onSave],
  );

  return (
    <div>
      <button
        type="button"
        onClick={handleBrowse}
        disabled={saving}
        className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-slate-700"
        title="Change projects folder"
      >
        <FolderOpenIcon className="h-5 w-5 shrink-0 text-slate-500 dark:text-slate-400" />
        <div className="min-w-0 flex-1">
          <div className="text-sm text-slate-700 dark:text-slate-300">
            Projects Folder
          </div>
          <div className="truncate text-xs text-slate-400 dark:text-slate-500">
            {saving ? 'Saving\u2026' : folder || 'Not configured'}
          </div>
        </div>
      </button>
      {error && (
        <p className="px-3 pb-1 text-xs text-rose-500 dark:text-rose-400">
          {error}
        </p>
      )}
    </div>
  );
};

export const MenuProjectsFolder = memo(MenuProjectsFolderComponent);
