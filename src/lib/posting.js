/**
 * One question, answered the same way everywhere: has this guest already shared
 * something at this wedding?
 *
 * A guest counts as having posted when either a media row or a note (messages
 * row) carries their guest id. Media and notes are the only things a guest can
 * publish, so this single predicate gates the upload button for every view.
 */
export function hasGuestPosted({ media = [], notes = [], guestId } = {}) {
  if (!guestId) return false;
  const mine = (row) => row && row.guest_id === guestId;
  return media.some(mine) || notes.some(mine);
}

