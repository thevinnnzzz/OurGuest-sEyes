import Avatar from '../feed/Avatar.jsx';
import { PlusIcon } from '../feed/icons.jsx';

/**
 * Sticky header for the guest gallery. The active guest's name leads — it is
 * the first thing the header shows, taken straight from the session — with the
 * couple, the closing countdown and the current tab on the quieter second line.
 */
export default function GalleryHeader({
  guestName,
  coupleNames,
  statusText,
  activeTabLabel,
  onShare,
  shareDisabled = false,
}) {
  const name = guestName?.trim() || 'Guest';
  const subtitle = [
    coupleNames,
    statusText && activeTabLabel ? `${statusText} · ${activeTabLabel}` : statusText || activeTabLabel,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <header className="sticky top-0 z-20 flex h-[var(--oge-header-h)] items-center gap-3 border-b border-brown/10 bg-cream/95 px-3 backdrop-blur">
      <Avatar name={name} size="md" ring />

      <div className="min-w-0 flex-1">
        <p
          title={name}
          className="truncate font-display text-[17px] font-semibold leading-tight text-brown-dark"
        >
          {name}
        </p>
        <p className="truncate text-[11px] text-brown/50">{subtitle}</p>
      </div>

      {onShare && (
        <button
          type="button"
          onClick={onShare}
          disabled={shareDisabled}
          aria-label="Share a moment"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-brown/20 bg-white text-brown transition hover:border-gold hover:text-gold disabled:opacity-40"
        >
          <PlusIcon className="h-5 w-5" />
        </button>
      )}
    </header>
  );
}
