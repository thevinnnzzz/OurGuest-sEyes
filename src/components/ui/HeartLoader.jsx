import HeartProgress from './HeartProgress.jsx';

/**
 * Full-screen loading state: the beating heart fills on a loop above a sweeping
 * bar, centred in the viewport so it reads the same on every screen size.
 */
export default function HeartLoader({ label = 'Loading…', hint = 'Gathering every moment…' }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-cream px-6 text-center"
    >
      <HeartProgress indeterminate />
      <p className="font-display text-lg font-semibold text-brown">{label}</p>
      <div className="w-full max-w-[15rem]">
        <div className="h-2 overflow-hidden rounded-full bg-brown/10">
          <div className="oge-bar-sweep h-full w-1/3 rounded-full bg-gradient-to-r from-rose/40 to-rose" />
        </div>
        {hint && <p className="mt-2 text-[11px] text-brown/45">{hint}</p>}
      </div>
    </div>
  );
}
