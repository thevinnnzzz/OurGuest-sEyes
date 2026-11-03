/**
 * Attribution text for anything a guest shares.
 *
 * The null check is the only way "Anonymous Guest" can appear: a real name is
 * never replaced, and no placeholder ("A guest", "Guest", "Unknown") is ever
 * invented. Whitespace-only names count as missing — they render as nothing
 * otherwise, which would break the attribution rule.
 */
export const ANONYMOUS_GUEST = 'Anonymous Guest';

export function resolvedGuestName(name) {
  if (name === null || name === undefined) return ANONYMOUS_GUEST;
  const trimmed = String(name).trim();
  return trimmed === '' ? ANONYMOUS_GUEST : trimmed;
}

/**
 * @param {'media'|'note'} kind
 * @param {string|null|undefined} name
 * @returns {{ label: string, guest: string, text: string }}
 */
export function attribution(kind, name) {
  const label = kind === 'note' ? 'Written by' : 'Captured by';
  const guest = resolvedGuestName(name);
  return { label, guest, text: `${label}: ${guest}` };
}

/** Attribution straight from a media/note row plus the id→name map. */
export function attributionFor(row, guestNameById = {}) {
  const kind = row?.type === undefined ? 'note' : 'media';
  const name = guestNameById[row?.guest_id] ?? row?.guests?.full_name ?? null;
  return attribution(kind, name);
}
