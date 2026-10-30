export const MIN_PHOTOS = 10;
export const MIN_VIDEOS = 5;

export const PHOTO_FILTERS = [
  { id: 'none', name: 'Original', css: 'none' },
  { id: 'hd', name: 'HD', css: 'saturate(1.12) contrast(1.05) brightness(1.03)' },
  { id: 'vintage90s', name: "90s Vintage", css: 'sepia(0.35) saturate(1.4) contrast(0.92) hue-rotate(-12deg)' },
  { id: 'retro', name: 'Retro', css: 'sepia(0.18) saturate(0.85) contrast(1.1) hue-rotate(-4deg)' },
  { id: 'sepia', name: 'Sepia', css: 'sepia(0.75) contrast(0.95)' },
  { id: 'classic', name: 'Classic', css: 'grayscale(1) contrast(1.12) brightness(0.97)' },
];

export const FILTER_BY_ID = Object.fromEntries(PHOTO_FILTERS.map((f) => [f.id, f.css]));

export function filterCss(id) {
  return FILTER_BY_ID[id] || 'none';
}

export function statusFor(wedding, now = new Date()) {
  const weddingDate = `${wedding.wedding_date}T00:00:00`;
  const expiresAt = wedding.expires_at ? new Date(wedding.expires_at) : null;
  if (expiresAt && now >= expiresAt) return 'expired';
  if (now < new Date(weddingDate)) return 'upcoming';
  return 'live';
}
