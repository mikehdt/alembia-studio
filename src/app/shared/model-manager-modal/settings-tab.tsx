'use client';

import { CheckIcon, CpuIcon, ExternalLinkIcon, TrashIcon } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import {
  selectKeepTaggerModelInMemory,
  setKeepTaggerModelInMemory,
} from '@/app/store/preferences';

import { Button } from '../button';
import { Checkbox } from '../checkbox';
import { Input } from '../input/input';

type ConfigResponse = {
  hfTokenMasked: string | null;
  hasHfToken: boolean;
};

export function SettingsTab() {
  const dispatch = useDispatch();
  const keepInMemory = useSelector(selectKeepTaggerModelInMemory);

  const [hasToken, setHasToken] = useState(false);
  const [maskedToken, setMaskedToken] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // GPU memory release
  const [unloading, setUnloading] = useState(false);
  const [unloadedAt, setUnloadedAt] = useState<number | null>(null);
  const [unloadError, setUnloadError] = useState<string | null>(null);

  const handleUnload = useCallback(async () => {
    setUnloading(true);
    setUnloadError(null);
    try {
      const res = await fetch('/api/auto-tagger/unload', { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to release GPU memory');
      }
      setUnloadedAt(Date.now());
    } catch (err) {
      setUnloadError(
        err instanceof Error ? err.message : 'Failed to release GPU memory',
      );
    } finally {
      setUnloading(false);
    }
  }, []);

  const showUnloadedPing =
    unloadedAt !== null && Date.now() - unloadedAt < 2500;

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/config');
      if (!res.ok) throw new Error('Failed to load config');
      const data = (await res.json()) as ConfigResponse;
      setHasToken(!!data.hasHfToken);
      setMaskedToken(data.hfTokenMasked);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load config');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const saveToken = useCallback(async (value: string) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hfToken: value }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save');
      }
      const data = (await res.json()) as ConfigResponse;
      setHasToken(!!data.hasHfToken);
      setMaskedToken(data.hfTokenMasked);
      setDraft('');
      setSavedAt(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }, []);

  const handleSave = useCallback(() => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    saveToken(trimmed);
  }, [draft, saveToken]);

  const handleClear = useCallback(() => {
    saveToken('');
  }, [saveToken]);

  const showSavedPing = savedAt !== null && Date.now() - savedAt < 2500;

  return (
    <div className="flex flex-col gap-5 px-1">
      {/* HuggingFace token */}
      <section className="flex flex-col gap-2">
        <div className="text-sm text-slate-500">
          <h3 className="text-lg font-medium text-slate-800 dark:text-slate-200">
            HuggingFace API Token
          </h3>
          <p className="mt-1">
            Required for downloading gated models (e.g. FLUX.1). Create one at{' '}
            <a
              href="https://huggingface.co/settings/tokens"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sky-600 hover:underline dark:text-sky-400"
            >
              huggingface.co/settings/tokens
              <ExternalLinkIcon className="h-3 w-3" />
            </a>
            .
          </p>
          <p>A read-only token is sufficient.</p>
        </div>

        {loading ? (
          <p className="text-slate-400">Loading…</p>
        ) : (
          <>
            {hasToken && (
              <div className="flex items-center justify-between rounded-md border border-teal-200 bg-teal-50/50 p-3 dark:border-teal-800 dark:bg-teal-950/30">
                <div className="flex items-center gap-2">
                  <CheckIcon className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                  <span className="text-slate-700 dark:text-slate-200">
                    Token set
                  </span>
                  {maskedToken && (
                    <code className="rounded bg-white/60 px-1.5 py-0.5 font-mono text-sm text-slate-600 dark:bg-slate-900/40 dark:text-slate-300">
                      {maskedToken}
                    </code>
                  )}
                </div>
                <Button
                  onClick={handleClear}
                  color="rose"
                  variant="ghost"
                  size="sm"
                  width="sm"
                  disabled={saving}
                >
                  <TrashIcon />
                  Clear
                </Button>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Input
                size="md"
                type="password"
                autoComplete="off"
                placeholder={hasToken ? 'Replace token…' : 'hf_…'}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave();
                }}
                className="flex-1 font-mono"
                disabled={saving}
              />

              <Button
                onClick={handleSave}
                color="indigo"
                size="md"
                width="lg"
                disabled={saving || draft.trim() === ''}
              >
                {saving ? 'Saving…' : hasToken ? 'Replace' : 'Save'}
              </Button>
            </div>

            {showSavedPing && (
              <p className="text-teal-600 dark:text-teal-400">Saved.</p>
            )}
          </>
        )}

        {error && (
          <div className="rounded-md bg-rose-50 p-3 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
            {error}
          </div>
        )}
      </section>

      {/* Tagger model memory */}
      <section className="flex flex-col gap-3">
        <div className="text-sm text-slate-500">
          <h3 className="text-lg font-medium text-slate-800 dark:text-slate-200">
            Tagger Model Memory
          </h3>
          <p className="mt-1">
            Captioning models can sit in GPU/CPU memory between runs for fast
            iteration, or release themselves after each batch to free memory for
            training and other apps.
          </p>
        </div>

        <Checkbox
          isSelected={keepInMemory}
          onChange={() => dispatch(setKeepTaggerModelInMemory(!keepInMemory))}
          label="Keep tagger models in memory after tagging"
        />

        <div className="flex items-center gap-3 pt-3">
          <Button
            onClick={handleUnload}
            color="slate"
            size="sm"
            width="md"
            disabled={unloading}
          >
            <CpuIcon />
            {unloading ? 'Releasing…' : 'Release now'}
          </Button>
          {showUnloadedPing && (
            <span className="text-teal-600 dark:text-teal-400">
              Model released
            </span>
          )}
        </div>

        {unloadError && (
          <div className="rounded-md bg-rose-50 p-3 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
            {unloadError}
          </div>
        )}
      </section>
    </div>
  );
}
