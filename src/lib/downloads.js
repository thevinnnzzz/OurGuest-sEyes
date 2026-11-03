import JSZip from 'jszip';
import { createNoteCardCanvas, ensureNoteCardFonts, noteCardToBlob } from './noteCard.js';
import { resolvedGuestName } from './attribution.js';

/**
 * Download manager for the gallery.
 *
 * One code path serves the three global filters and the per-item saves, so a
 * photo pulled out on its own is byte-identical to the one inside the archive.
 */

export const DOWNLOAD_FILTERS = [
  { id: 'all', label: 'Download All Items' },
  { id: 'media', label: 'Download Photos/Videos Only' },
  { id: 'notes', label: 'Download Note Cards Only' },
];

const FILTER_IDS = DOWNLOAD_FILTERS.map((entry) => entry.id);

/** How many items each filter would produce. */
export function downloadCounts({ media = [], notes = [] } = {}) {
  const noteCards = notes.filter((note) => (note?.body || '').trim().length > 0);
  const photos = media.filter((item) => item?.type !== 'video').length;
  const videos = media.length - photos;
  return {
    photos,
    videos,
    media: media.length,
    notes: noteCards.length,
    all: media.length + noteCards.length,
  };
}

/**
 * Pure filter: the modal's radio state maps to exactly this. An unknown filter
 * is a programming error, not something to silently widen to "all".
 */
export function selectDownloadItems({ media = [], notes = [], filter = 'all' } = {}) {
  if (!FILTER_IDS.includes(filter)) {
    throw new TypeError(`Unknown download filter "${filter}" (expected ${FILTER_IDS.join(', ')})`);
  }
  const noteCards = notes.filter((note) => (note?.body || '').trim().length > 0);
  if (filter === 'media') return { media: [...media], notes: [] };
  if (filter === 'notes') return { media: [], notes: noteCards };
  return { media: [...media], notes: noteCards };
}

function slugify(value) {
  return (
    String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'guest'
  );
}

export function mediaFileName(item, index, guestName) {
  const ext = item?.type === 'video' ? 'mp4' : 'jpg';
  const kind = item?.type === 'video' ? 'video' : 'photo';
  return `${String(index + 1).padStart(3, '0')}-${kind}-by-${slugify(resolvedGuestName(guestName))}.${ext}`;
}

export function noteDownloadName(note, index, guestName) {
  const stamp = String(note?.created_at || '').slice(0, 10) || 'note';
  return `${String(index + 1).padStart(3, '0')}-note-by-${slugify(resolvedGuestName(guestName))}-${stamp}.png`;
}

export async function fetchBlob(url) {
  const response = await fetch(url, { mode: 'cors' });
  if (!response.ok) {
    throw new Error(`Could not fetch ${String(url).split('/').pop()} (HTTP ${response.status})`);
  }
  return response.blob();
}

/** Hands a blob to the browser as a download; returns what it saved. */
export function saveBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return { fileName, size: blob.size };
}

/** Individual save for one photo, video, or note card. */
export async function saveItem({ item, kind = 'media', guestName, index = 0 }) {
  if (kind === 'note') {
    await ensureNoteCardFonts();
    const canvas = createNoteCardCanvas(
      {
        id: item.id,
        body: item.body,
        createdAt: item.created_at,
        guestName: resolvedGuestName(guestName),
      },
      { scale: 2 },
    );
    const blob = await noteCardToBlob(canvas, { format: 'png' });
    return saveBlob(blob, noteDownloadName(item, index, guestName));
  }
  const blob = await fetchBlob(item.url);
  return saveBlob(blob, mediaFileName(item, index, guestName));
}

/**
 * Builds the archive for one filter. Fetch and render failures are collected
 * rather than aborting the whole download — the caller reports how many of how
 * many items actually made it in.
 */
export async function buildGalleryZip({
  media = [],
  notes = [],
  filter = 'all',
  guestNameById = {},
  zipName = 'our-guests-eyes.zip',
  onProgress = () => {},
} = {}) {
  const selection = selectDownloadItems({ media, notes, filter });
  const total = selection.media.length + selection.notes.length;
  const zip = new JSZip();
  const failures = [];

  const mediaFolder = selection.notes.length ? zip.folder('photos-and-videos') : zip;
  const noteFolder = selection.media.length ? zip.folder('note-cards') : zip;

  if (selection.notes.length) await ensureNoteCardFonts();

  let done = 0;
  const tick = (label) => {
    done += 1;
    onProgress({ done, total, label });
  };

  for (let index = 0; index < selection.media.length; index += 1) {
    const item = selection.media[index];
    const guestName = guestNameById[item.guest_id];
    try {
      const blob = await fetchBlob(item.url);
      mediaFolder.file(mediaFileName(item, index, guestName), blob);
    } catch (error) {
      failures.push({ item, reason: error.message });
    }
    tick(item.url?.split('/').pop() || 'media');
  }

  for (let index = 0; index < selection.notes.length; index += 1) {
    const note = selection.notes[index];
    const guestName = guestNameById[note.guest_id] ?? note.guests?.full_name ?? null;
    try {
      const canvas = createNoteCardCanvas(
        { id: note.id, body: note.body, createdAt: note.created_at, guestName: resolvedGuestName(guestName) },
        { scale: 2 },
      );
      noteFolder.file(noteDownloadName(note, index, guestName), await noteCardToBlob(canvas, { format: 'png' }));
    } catch (error) {
      failures.push({ item: note, reason: error.message });
    }
    tick(`Note from ${resolvedGuestName(guestName)}`);
  }

  onProgress({ done: total, total, label: 'Zipping…' });
  const blob = await zip.generateAsync({ type: 'blob' }, (meta) =>
    onProgress({ done: total, total, label: `Zipping… ${Math.round(meta.percent)}%` }),
  );

  return { blob, name: zipName, total, included: total - failures.length, failures };
}
