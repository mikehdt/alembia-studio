'use client';

import { Button } from './button';

/**
 * Temporary playground for testing button styles in light/dark mode.
 * Remove this component after testing is complete.
 */
export const DevUIPlayground = () => {
  return (
    <div className="mb-4 rounded-lg border border-(--border) bg-(--surface) p-4">
      <h3 className="mb-4 text-sm font-bold text-(--foreground)">
        UI Playground (temporary)
      </h3>

      {/* Ghost buttons - the main issue */}
      <div className="mb-4">
        <p className="mb-2 text-xs text-(--unselected-text)">
          Ghost buttons (slate):
        </p>
        <div className="flex items-center gap-2 rounded bg-(--surface-elevated) p-2">
          <Button variant="ghost" color="slate" size="md">
            Normal
          </Button>
          <Button variant="ghost" color="slate" size="md" disabled>
            Disabled
          </Button>
          <Button variant="ghost" color="slate" size="md" isPressed>
            Pressed
          </Button>
        </div>
      </div>

      {/* Default buttons for comparison */}
      <div className="mb-4">
        <p className="mb-2 text-xs text-(--unselected-text)">
          Default buttons (slate):
        </p>
        <div className="flex items-center gap-2 rounded bg-(--surface-elevated) p-2">
          <Button variant="default" color="slate" size="md">
            Normal
          </Button>
          <Button variant="default" color="slate" size="md" disabled>
            Disabled
          </Button>
          <Button variant="default" color="slate" size="md" isPressed>
            Pressed
          </Button>
        </div>
      </div>

      {/* Toggle buttons */}
      <div className="mb-4">
        <p className="mb-2 text-xs text-(--unselected-text)">
          Toggle buttons (slate):
        </p>
        <div className="flex items-center gap-2 rounded bg-(--surface-elevated) p-2">
          <Button variant="toggle" color="slate" size="md">
            Unpressed
          </Button>
          <Button variant="toggle" color="slate" size="md" isPressed>
            Pressed
          </Button>
          <Button variant="toggle" color="slate" size="md" disabled>
            Disabled
          </Button>
        </div>
      </div>

      {/* Raw test - direct classes */}
      <div className="mb-4">
        <p className="mb-2 text-xs text-(--unselected-text)">Raw class test:</p>
        <div className="flex items-center gap-4 rounded bg-(--surface-elevated) p-2">
          <span className="text-slate-700">text-slate-700</span>
          <span className="text-slate-400 dark:text-slate-400">
            dark:text-slate-400
          </span>
          <span className="text-slate-700 dark:text-slate-300">
            700 / dark:300
          </span>
        </div>
      </div>

      {/* Background test */}
      <div>
        <p className="mb-2 text-xs text-(--unselected-text)">
          Current html class:{' '}
          <code className="rounded bg-(--surface-muted) px-1">
            {typeof document !== 'undefined'
              ? document.documentElement.className || '(none)'
              : 'SSR'}
          </code>
        </p>
      </div>
    </div>
  );
};
