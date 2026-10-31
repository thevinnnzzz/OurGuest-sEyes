const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

export function HeartIcon({ filled = false, className = 'h-6 w-6' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...stroke} fill={filled ? 'currentColor' : 'none'}>
      <path d="M12 20.7 4.6 13.4a4.6 4.6 0 0 1 0-6.6 4.7 4.7 0 0 1 6.6 0l.8.8.8-.8a4.7 4.7 0 0 1 6.6 0 4.6 4.6 0 0 1 0 6.6Z" />
    </svg>
  );
}

export function CommentIcon({ className = 'h-6 w-6' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...stroke}>
      <path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.4 9 9 0 0 1-3.9-.9L3 21l1.9-5.4A8.4 8.4 0 0 1 12.5 3 8.4 8.4 0 0 1 21 11.5Z" />
    </svg>
  );
}

export function SendIcon({ className = 'h-6 w-6' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...stroke}>
      <path d="m21 3-8.5 18-2.2-7.3L3 11.5Z" />
    </svg>
  );
}

export function BookmarkIcon({ className = 'h-6 w-6' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...stroke}>
      <path d="M6 3.5h12v17l-6-4-6 4Z" />
    </svg>
  );
}

export function GridIcon({ className = 'h-6 w-6' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...stroke}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.4" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.4" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.4" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.4" />
    </svg>
  );
}

export function PlayIcon({ className = 'h-6 w-6' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...stroke}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <path d="m10 8.5 6 3.5-6 3.5Z" />
    </svg>
  );
}

export function NoteIcon({ className = 'h-6 w-6' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...stroke}>
      <path d="M20.5 12a7.3 7.3 0 0 1-7.4 7.2H8.4L4 21l1-4.1A7.2 7.2 0 0 1 3.5 12 7.3 7.3 0 0 1 11 4.8h2.2a7.3 7.3 0 0 1 7.3 7.2Z" />
      <path d="M8.8 10.5h6.4M8.8 13.8h4.2" />
    </svg>
  );
}

export function CardsIcon({ className = 'h-6 w-6' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...stroke}>
      <rect x="3.5" y="3.5" width="7.5" height="10" rx="2" />
      <rect x="13" y="3.5" width="7.5" height="6" rx="2" />
      <rect x="3.5" y="15.5" width="7.5" height="5" rx="2" />
      <rect x="13" y="11.5" width="7.5" height="9" rx="2" />
    </svg>
  );
}

export function PlusIcon({ className = 'h-6 w-6' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...stroke}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function MoreIcon({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor">
      <circle cx="5" cy="12" r="1.7" />
      <circle cx="12" cy="12" r="1.7" />
      <circle cx="19" cy="12" r="1.7" />
    </svg>
  );
}

export function MuteIcon({ muted, className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...stroke}>
      <path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4Z" />
      {muted ? <path d="m16.5 9.5 4 4m0-4-4 4" /> : <path d="M15.8 9a4 4 0 0 1 0 6M18.4 6.6a7.4 7.4 0 0 1 0 10.8" />}
    </svg>
  );
}

export function LogoutIcon({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...stroke}>
      <path d="M15 4.5h3.5a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5H15" />
      <path d="M10.5 15.5 14 12l-3.5-3.5M14 12H4" />
    </svg>
  );
}

export function TrashIcon({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...stroke}>
      <path d="M4 7h16M9 7V5.2A1.2 1.2 0 0 1 10.2 4h3.6A1.2 1.2 0 0 1 15 5.2V7" />
      <path d="M6.4 7l.7 11.9a1.5 1.5 0 0 0 1.5 1.4h6.8a1.5 1.5 0 0 0 1.5-1.4L17.6 7" />
      <path d="M10.2 11v6M13.8 11v6" />
    </svg>
  );
}

export function PauseIcon({ className = 'h-10 w-10' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor">
      <rect x="7" y="5" width="3.4" height="14" rx="1" />
      <rect x="13.6" y="5" width="3.4" height="14" rx="1" />
    </svg>
  );
}
