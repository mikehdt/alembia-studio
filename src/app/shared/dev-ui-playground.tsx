'use client';

import { SquareIcon } from 'lucide-react';

import { Button } from './button';
import { Dropdown } from './dropdown';
import { Input } from './input';
import { InputTray } from './input-tray/input-tray';
import { MultiTagInput } from './multi-tag-input';
import { SegmentedControl } from './segmented-control/segmented-control';

/**
 * Temporary playground for testing UI sizes and styles.
 */
export const DevUIPlayground = () => {
  return (
    <div className="mb-4 rounded-lg border border-(--border) bg-(--surface) p-4">
      <h3 className="mb-4 text-sm font-bold text-(--foreground)">
        UI Playground (temporary)
      </h3>

      <div className="mb-4 flex flex-col gap-2">
        <p className="mb-2 text-xs text-(--unselected-text) uppercase">
          xs sizes (22px high)
        </p>

        <div className="flex items-center gap-2 bg-slate-200 dark:bg-slate-700">
          <Button width="xs" size="xs">
            Button
          </Button>

          <Button width="xs" size="xs">
            <SquareIcon /> Button
          </Button>

          <Button width="xs" size="xs">
            <SquareIcon />
          </Button>
        </div>

        <div className="flex items-center bg-slate-200 dark:bg-slate-700">
          <Input size="xs" />
        </div>

        <div className="flex items-center bg-slate-200 dark:bg-slate-700">
          <Input size="xs" />
          <Button width="xs" size="xs">
            Button
          </Button>
          <Button width="xs" size="xs">
            <SquareIcon /> Button
          </Button>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-2">
        <p className="mb-2 text-xs text-(--unselected-text) uppercase">
          sm sizes (30px high)
        </p>

        <div className="flex items-center gap-2 bg-slate-200 dark:bg-slate-700">
          <Button width="sm" size="sm">
            Button
          </Button>

          <Button width="sm" size="sm">
            <SquareIcon /> Button
          </Button>

          <Button width="sm" size="sm">
            <SquareIcon />
          </Button>
        </div>

        <div className="flex items-center bg-slate-200 dark:bg-slate-700">
          <Input size="sm" />
        </div>

        <div className="flex items-center bg-slate-200 dark:bg-slate-700">
          <Dropdown
            size="sm"
            items={[
              { value: 'test-a', label: 'Test A' },
              { value: 'test-b', label: 'Test B' },
            ]}
            selectedValue="test-a"
            onChange={() => {}}
          />
        </div>

        <div className="flex items-center gap-2 bg-slate-200 dark:bg-slate-700">
          <Input size="sm" />

          <Button width="sm" size="sm">
            Button
          </Button>

          <Button width="sm" size="sm">
            <SquareIcon /> Button
          </Button>

          <Dropdown
            size="sm"
            items={[
              { value: 'test-a', label: 'Test A' },
              { value: 'test-b', label: 'Test B' },
            ]}
            selectedValue="test-a"
            onChange={() => {}}
          />
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-2">
        <p className="mb-2 text-xs text-(--unselected-text) uppercase">
          toolbar sizes (30px high)
        </p>

        <div className="flex items-center gap-2 bg-slate-200 dark:bg-slate-700">
          <Button width="toolbar" size="toolbar">
            Button
          </Button>

          <Button width="toolbar" size="toolbar">
            <SquareIcon /> Button
          </Button>

          <Button width="toolbar" size="toolbar">
            <SquareIcon />
          </Button>
        </div>

        <div className="flex items-center bg-slate-200 dark:bg-slate-700">
          <Input size="toolbar" />
        </div>

        <div className="flex items-center bg-slate-200 dark:bg-slate-700">
          <Dropdown
            size="toolbar"
            items={[
              { value: 'test-a', label: 'Test A' },
              { value: 'test-b', label: 'Test B' },
            ]}
            selectedValue="test-a"
            onChange={() => {}}
          />
        </div>

        <div className="flex items-center gap-2 bg-slate-200 dark:bg-slate-700">
          <Input size="toolbar" />

          <Button width="toolbar" size="toolbar">
            Button
          </Button>

          <Button width="toolbar" size="toolbar">
            <SquareIcon /> Button
          </Button>

          <Dropdown
            size="toolbar"
            items={[
              { value: 'test-a', label: 'Test A' },
              { value: 'test-b', label: 'Test B' },
            ]}
            selectedValue="test-a"
            onChange={() => {}}
          />

          <SegmentedControl
            options={[
              { value: 'simple', label: 'Simple' },
              { value: 'intermediate', label: 'Intermediate' },
            ]}
            value="simple"
            onChange={() => {}}
          />
        </div>

        <div className="flex items-center bg-slate-200 dark:bg-slate-700">
          <InputTray size="md">
            <Input size="toolbar" />

            <Button width="toolbar" size="toolbar">
              Button
            </Button>

            <Button width="toolbar" size="toolbar">
              <SquareIcon /> Button
            </Button>

            <Dropdown
              size="toolbar"
              items={[
                { value: 'test-a', label: 'Test A' },
                { value: 'test-b', label: 'Test B' },
              ]}
              selectedValue="test-a"
              onChange={() => {}}
            />
          </InputTray>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-2">
        <p className="mb-2 text-xs text-(--unselected-text) uppercase">
          md sizes (34px high)
        </p>

        <div className="flex items-center gap-2 bg-slate-200 dark:bg-slate-700">
          <Button width="md" size="md">
            Button
          </Button>

          <Button width="md" size="md">
            <SquareIcon /> Button
          </Button>

          <Button width="md" size="md">
            <SquareIcon />
          </Button>
        </div>

        <div className="flex items-center bg-slate-200 dark:bg-slate-700">
          <Dropdown
            size="md"
            items={[
              { value: 'test-a', label: 'Test A' },
              { value: 'test-b', label: 'Test B' },
            ]}
            selectedValue="test-a"
            onChange={() => {}}
          />
        </div>

        <div className="flex items-center gap-2 bg-slate-200 dark:bg-slate-700">
          <Input size="md" />

          <Button width="md" size="md">
            Button
          </Button>

          <Button width="md" size="md">
            <SquareIcon /> Button
          </Button>

          <Dropdown
            size="md"
            items={[
              { value: 'test-a', label: 'Test A' },
              { value: 'test-b', label: 'Test B' },
            ]}
            selectedValue="test-a"
            onChange={() => {}}
          />
        </div>

        <div className="flex items-center bg-slate-200 dark:bg-slate-700">
          <InputTray size="md">
            <Input size="md" />

            <Button width="md" size="md">
              Button
            </Button>

            <Button width="md" size="md">
              <SquareIcon /> Button
            </Button>

            <Dropdown
              size="md"
              items={[
                { value: 'test-a', label: 'Test A' },
                { value: 'test-b', label: 'Test B' },
              ]}
              selectedValue="test-a"
              onChange={() => {}}
            />
          </InputTray>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-2">
        <p className="mb-2 text-xs text-(--unselected-text) uppercase">
          lg sizes (42px high)
        </p>

        <div className="flex items-center gap-2 bg-slate-200 dark:bg-slate-700">
          <Button width="lg" size="lg">
            Button
          </Button>

          <Button width="lg" size="lg">
            <SquareIcon /> Button
          </Button>

          <Button width="lg" size="lg">
            <SquareIcon />
          </Button>
        </div>

        <div className="flex items-center bg-slate-200 dark:bg-slate-700">
          <Dropdown
            size="lg"
            items={[
              { value: 'test-a', label: 'Test A' },
              { value: 'test-b', label: 'Test B' },
            ]}
            selectedValue="test-a"
            onChange={() => {}}
          />
        </div>

        <div className="flex items-center gap-2 bg-slate-200 dark:bg-slate-700">
          <Input size="lg" />

          <Button width="lg" size="lg">
            Button
          </Button>

          <Button width="lg" size="lg">
            <SquareIcon /> Button
          </Button>

          <Dropdown
            size="lg"
            items={[
              { value: 'test-a', label: 'Test A' },
              { value: 'test-b', label: 'Test B' },
            ]}
            selectedValue="test-a"
            onChange={() => {}}
          />

          <MultiTagInput tags={[]} onTagsChange={() => {}} />
        </div>

        <div className="flex items-center bg-slate-200 dark:bg-slate-700">
          <InputTray size="md">
            <Input size="lg" />

            <Button width="lg" size="lg">
              Button
            </Button>

            <Button width="lg" size="lg">
              <SquareIcon /> Button
            </Button>

            <Dropdown
              size="lg"
              items={[
                { value: 'test-a', label: 'Test A' },
                { value: 'test-b', label: 'Test B' },
              ]}
              selectedValue="test-a"
              onChange={() => {}}
            />
          </InputTray>
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
