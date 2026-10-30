function initials(name) {
  const parts = (name || 'Guest').trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

const SIZES = {
  sm: 'h-7 w-7 text-[10px]',
  md: 'h-9 w-9 text-xs',
  lg: 'h-12 w-12 text-sm',
};

export default function Avatar({ name, size = 'md', ring = false }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-rose to-brown font-semibold text-cream ${SIZES[size]} ${
        ring ? 'ring-2 ring-gold ring-offset-2 ring-offset-cream' : ''
      }`}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}
