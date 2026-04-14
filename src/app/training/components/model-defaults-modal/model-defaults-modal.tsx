'use client';

import { FolderOpenIcon } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/app/components/shared/button';
import { Input } from '@/app/components/shared/input/input';
import { InputTray } from '@/app/components/shared/input-tray/input-tray';
import { Modal } from '@/app/components/shared/modal';
import {
  getModelsByArchitecture,
  type ModelComponentType,
} from '@/app/services/training/models';

import type { AppModelDefaults } from '../training-config-form/use-training-config-form';

const MODEL_FILE_FILTER = 'safetensors,ckpt,bin,pt,pth';

type ModelDefaultsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (defaults: AppModelDefaults) => void;
};

/** Models grouped by architecture, for display in the defaults modal. */
const MODEL_GROUPS = getModelsByArchitecture();

export function ModelDefaultsModal({
  isOpen,
  onClose,
  onSaved,
}: ModelDefaultsModalProps) {
  const [draft, setDraft] = useState<AppModelDefaults>({});
  const [saving, setSaving] = useState(false);

  // Load current defaults when modal opens
  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/config/model-defaults')
      .then((r) => r.json())
      .then(setDraft)
      .catch(() => {});
  }, [isOpen]);

  const setPath = useCallback(
    (modelId: string, comp: ModelComponentType, value: string) => {
      setDraft((prev) => ({
        ...prev,
        [modelId]: { ...prev[modelId], [comp]: value },
      }));
    },
    [],
  );

  const handleBrowse = useCallback(
    async (modelId: string, comp: ModelComponentType, label: string) => {
      try {
        const params = new URLSearchParams({
          title: `Select ${label}`,
          filter: MODEL_FILE_FILTER,
        });
        const res = await fetch(`/api/filesystem/browse?${params}`);
        const data = await res.json();
        if (data.path) {
          setPath(modelId, comp, data.path);
        }
      } catch {
        // Dialog failed — user can type manually
      }
    },
    [setPath],
  );

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/config/model-defaults', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const saved = await res.json();
      onSaved(saved);
      onClose();
    } catch {
      // TODO: toast error
    } finally {
      setSaving(false);
    }
  }, [draft, onClose, onSaved]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-xl">
      <div className="flex flex-col gap-5">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-300">
            Default Model Paths
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Set default file paths for model components. These will be
            pre-filled when you start a new training run.
          </p>
        </div>

        <div className="flex flex-col gap-5 pr-1">
          {MODEL_GROUPS.map(({ architecture, label, models }) => (
            <div key={architecture}>
              <h3 className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
                {label}
              </h3>
              <div className="space-y-4">
                {models.map((model) => (
                  <div key={model.id}>
                    {models.length > 1 && (
                      <p className="mb-1 text-xs text-slate-400">
                        {model.name}
                      </p>
                    )}
                    <div className="space-y-2">
                      {model.components.map((comp) => (
                        <div key={comp.type}>
                          <label className="mb-2 flex items-baseline gap-1.5 text-xs font-medium text-(--foreground)/70">
                            {comp.label}
                            {!comp.required && (
                              <span className="font-normal text-slate-400">
                                (optional)
                              </span>
                            )}
                          </label>

                          <InputTray size="md" className="dark:bg-slate-900">
                            <Input
                              type="text"
                              value={draft[model.id]?.[comp.type] ?? ''}
                              onChange={(e) =>
                                setPath(model.id, comp.type, e.target.value)
                              }
                              placeholder={`Path to ${comp.label.toLowerCase()}…`}
                              className="min-w-0 flex-1"
                            />
                            <Button
                              onClick={() =>
                                handleBrowse(model.id, comp.type, comp.label)
                              }
                              variant="ghost"
                              size="md"
                              width="md"
                              title="Browse…"
                            >
                              <FolderOpenIcon />
                            </Button>
                          </InputTray>
                          {comp.hint && (
                            <p className="mt-0.5 text-xs text-slate-400">
                              {comp.hint}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2 border-t border-(--border-subtle) pt-3">
          <Button onClick={onClose} color="slate" size="md">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            color="indigo"
            size="md"
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save Defaults'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
