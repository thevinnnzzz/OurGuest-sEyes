import { useEffect, useId, useState } from 'react';

// The heart path spans roughly y=4.5 (top) to y=20.7 (bottom).
const HEART_TOP = 20.7;
const HEART_HEIGHT = 16.2;
const HEART_PATH =
  'M12 20.7 4.6 13.4a4.6 4.6 0 0 1 0-6.6 4.7 4.7 0 0 1 6.6 0l.8.8.8-.8a4.7 4.7 0 0 1 6.6 0 4.6 4.6 0 0 1 0 6.6Z';

const LOOP_MS = 2600;
const FILL_SHARE = 0.86; // fill, then hold briefly before the next beat
const STEP_MS = 70;

/**
 * A beating heart that fills from the bottom up.
 *
 * - Determinate: pass `value` (0–100) to show real progress, as the admin
 *   delete flow does.
 * - Indeterminate: pass `indeterminate` to loop the fill while work is in
 *   flight, for screens that cannot know the percentage. Anyone who asked for
 *   reduced motion gets a still, partly filled heart.
 */
export default function HeartProgress({ value = 0, indeterminate = false, className = 'h-20 w-20' }) {
  // useId keeps two hearts on one page from sharing a clip path.
  const clipId = `oge-heart-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [loopValue, setLoopValue] = useState(0);

  useEffect(() => {
    if (!indeterminate) return undefined;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setLoopValue(55);
      return undefined;
    }
    const started = performance.now();
    const id = setInterval(() => {
      const progress = ((performance.now() - started) % LOOP_MS) / LOOP_MS;
      const filled = Math.min(1, progress / FILL_SHARE);
      setLoopValue(Math.round(100 * (1 - (1 - filled) ** 2)));
    }, STEP_MS);
    return () => clearInterval(id);
  }, [indeterminate]);

  const clamped = Math.max(0, Math.min(100, indeterminate ? loopValue : value));
  const top = HEART_TOP - HEART_HEIGHT * (clamped / 100);

  return (
    <svg viewBox="0 0 24 24" className={`oge-heartbeat text-rose ${className}`} aria-hidden="true">
      <defs>
        <clipPath id={clipId}>
          <rect x="0" y={top} width="24" height="24" />
        </clipPath>
      </defs>
      <path
        d={HEART_PATH}
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.28"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      <path d={HEART_PATH} fill="currentColor" clipPath={`url(#${clipId})`} />
    </svg>
  );
}
