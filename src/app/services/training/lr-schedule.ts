/**
 * Client-side reconstruction of the LR schedule shape as a normalised 0–1
 * curve. Backends don't stream per-step LR reliably (Kohya's progress bar
 * carries none), so the chart's background layer is derived from the job's
 * scheduler config instead — which also lets it span the whole run up front
 * rather than only the steps observed so far.
 */

type LrScheduleArgs = {
  scheduler: string | undefined;
  totalSteps: number;
  warmupSteps?: number;
  /** Cycle count for cosine_with_restarts (Kohya's lr_scheduler_num_cycles). */
  numRestarts?: number;
};

const CURVE_POINTS = 96;

function decayFor(
  scheduler: string,
  numRestarts: number,
): ((t: number) => number) | null {
  switch (scheduler) {
    case 'constant':
    case 'constant_with_warmup':
      return () => 1;
    case 'linear':
      return (t) => 1 - t;
    case 'cosine':
      return (t) => 0.5 * (1 + Math.cos(Math.PI * t));
    case 'cosine_with_restarts': {
      const cycles = Math.max(1, Math.round(numRestarts));
      // Matches diffusers: each cycle decays 1 → 0 then snaps back up.
      return (t) =>
        t >= 1 ? 0 : 0.5 * (1 + Math.cos(Math.PI * ((cycles * t) % 1)));
    }
    default:
      return null;
  }
}

/**
 * Returns null when there's nothing worth drawing: unknown scheduler, or a
 * flat constant schedule with no warmup (a full-plot wash carries no
 * information).
 */
export function buildLrScheduleCurve({
  scheduler,
  totalSteps,
  warmupSteps = 0,
  numRestarts = 1,
}: LrScheduleArgs): number[] | null {
  if (!scheduler) return null;
  const decay = decayFor(scheduler, numRestarts);
  if (!decay) return null;

  const warmupFrac =
    totalSteps > 0 ? Math.min(Math.max(warmupSteps / totalSteps, 0), 1) : 0;
  if (scheduler === 'constant' && warmupFrac === 0) return null;

  return Array.from({ length: CURVE_POINTS }, (_, i) => {
    const t = i / (CURVE_POINTS - 1);
    if (warmupFrac > 0 && t < warmupFrac) return t / warmupFrac;
    const progress = warmupFrac < 1 ? (t - warmupFrac) / (1 - warmupFrac) : 1;
    return decay(progress);
  });
}
