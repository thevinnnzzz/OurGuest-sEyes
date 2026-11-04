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
  shareLabel = 'Share a moment',
  shareDisabled = false,
  onOpenProfile,
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
      {/* The identity block opens the guest's profile settings. */}
      <button
        type="button"
        onClick={onOpenProfile}
        disabled={!onOpenProfile}
        aria-label={onOpenProfile ? 'Open your profile and account settings' : undefined}
        className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-default"
      >
        <Avatar name={name} size="md" ring />

        <span className="min-w-0 flex-1">
          <span
            title={name}
            className="block truncate font-display text-[17px] font-semibold leading-tight text-brown-dark"
          >
            {name}
          </span>
          <span className="block truncate text-[11px] text-brown/50">{subtitle}</span>
        </span>
      </button>

      {onShare && (
        <button
          type="button"
          onClick={onShare}
          disabled={shareDisabled}
          aria-label={shareLabel}
          title={shareLabel}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-brown/20 bg-white text-brown transition hover:border-gold hover:text-gold disabled:opacity-40"
        >
          <PlusIcon className="h-5 w-5" />
        </button>
      )}
    </header>
  );
}
