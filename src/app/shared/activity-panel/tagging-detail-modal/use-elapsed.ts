import { useEffect, useState } from 'react';

/**
 * Elapsed milliseconds for a job, ticking once a second while it runs. Once
 * `completedAt` lands, the authoritative span takes over — it may differ from
 * the live estimate by a second or two, which is acceptable drift for a
 * progress readout.
 *
 * A 1s `setInterval` rather than `requestAnimationFrame`: the display only
 * changes once a second, so repainting every frame buys nothing.
 */
export function useElapsed(
  startedAt: number | null,
  completedAt: number | null,
): number | null {
  const running = startedAt != null && completedAt == null;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!running) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);

  if (startedAt == null) return null;
  if (completedAt != null) return completedAt - startedAt;
  return Math.max(0, now - startedAt);
}
