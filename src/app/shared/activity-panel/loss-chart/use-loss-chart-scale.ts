import { useMemo } from 'react';

import type { LossPoint } from '@/app/services/training/types';

type UseLossChartScaleArgs = {
  lossHistory: LossPoint[];
  totalSteps: number;
  width: number;
  height: number;
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
};

/** Minimum points before an EMA overlay says anything the raw line doesn't. */
const MIN_POINTS_FOR_SMOOTHING = 8;

/** Debiased EMA weight — TensorBoard-style trend line over noisy loss. */
const EMA_BETA = 0.9;

/**
 * A "nice" rounding step (1/2/5 × 10^n). Fine-grained (≈8 steps over the
 * range) — only three ticks get labelled, so a finer step costs nothing and
 * keeps the domain snug against the data.
 */
function niceStep(range: number): number {
  if (!Number.isFinite(range) || range <= 0) return 1;
  const rough = range / 8;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const normalised = rough / magnitude;
  const nice =
    normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10;
  return nice * magnitude;
}

/**
 * Y-domain fitted to where the loss actually sits, so a curve hovering
 * around 0.05 doesn't render as a flat line at the bottom of a 0–0.1 plot.
 *
 * - Top: clamped just above the 95th percentile — warmup/first-batch spikes
 *   clip at the top edge instead of distorting the whole scale.
 * - Bottom: raised off zero (to a nice tick below the 5th percentile) only
 *   when the data floats well clear of it; otherwise the zero baseline stays.
 */
function computeDomain(losses: number[]): { yMin: number; yMax: number } {
  if (losses.length === 0) return { yMin: 0, yMax: 1 };
  const sorted = [...losses].sort((a, b) => a - b);
  const at = (frac: number) =>
    sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * frac))];

  const max = sorted[sorted.length - 1];
  let hi = Math.min(max, at(0.95) * 1.15);
  let lo = at(0.05);
  if (hi <= lo) {
    // Flat (or single-point) series — pad so the line sits mid-plot.
    hi = lo > 0 ? lo * 1.1 : 1;
    lo = lo > 0 ? lo * 0.9 : 0;
  }

  const zoomed = lo > hi * 0.25;
  const step = niceStep(hi - (zoomed ? lo : 0));
  return {
    yMin: zoomed ? Math.max(0, Math.floor(lo / step) * step) : 0,
    yMax: Math.ceil(hi / step) * step,
  };
}

/** Debiased exponential moving average (TensorBoard's smoothing formula). */
function smoothLosses(losses: number[]): number[] {
  const out: number[] = [];
  let acc = 0;
  for (let i = 0; i < losses.length; i++) {
    acc = acc * EMA_BETA + (1 - EMA_BETA) * losses[i];
    out.push(acc / (1 - EMA_BETA ** (i + 1)));
  }
  return out;
}

/** Shared scale maths for the compact and detail loss chart variants. */
export function useLossChartScale({
  lossHistory,
  totalSteps,
  width,
  height,
  paddingTop,
  paddingRight,
  paddingBottom,
  paddingLeft,
}: UseLossChartScaleArgs) {
  return useMemo(() => {
    const innerWidth = Math.max(1, width - paddingLeft - paddingRight);
    const innerHeight = Math.max(1, height - paddingTop - paddingBottom);

    const steps = lossHistory.map((p) => p.step);
    const losses = lossHistory.map((p) => p.loss);
    const maxObservedStep = steps.length > 0 ? Math.max(...steps) : 0;
    const xMax = totalSteps > 0 ? totalSteps : Math.max(1, maxObservedStep);
    const { yMin, yMax } = computeDomain(losses);

    const xScale = (step: number) =>
      paddingLeft + (Math.min(Math.max(step, 0), xMax) / xMax) * innerWidth;

    const yScale = (loss: number) =>
      paddingTop +
      (1 - (Math.min(Math.max(loss, yMin), yMax) - yMin) / (yMax - yMin)) *
        innerHeight;

    const toPath = (values: number[]) =>
      values
        .map(
          (loss, i) =>
            `${i === 0 ? 'M' : 'L'}${xScale(lossHistory[i].step)},${yScale(loss)}`,
        )
        .join(' ');

    const linePath = lossHistory.length >= 2 ? toPath(losses) : null;
    const smoothedPath =
      lossHistory.length >= MIN_POINTS_FOR_SMOOTHING
        ? toPath(smoothLosses(losses))
        : null;

    const yTicks = [yMin, (yMin + yMax) / 2, yMax];

    return {
      innerWidth,
      innerHeight,
      xMax,
      yMin,
      yMax,
      yTicks,
      xScale,
      yScale,
      linePath,
      smoothedPath,
    };
  }, [
    lossHistory,
    totalSteps,
    width,
    height,
    paddingTop,
    paddingRight,
    paddingBottom,
    paddingLeft,
  ]);
}
