import { useEffect, useState } from 'react';
import Modal from '../ui/Modal.jsx';
import {
  createNoteCardCanvas,
  downloadNoteCard,
  ensureNoteCardFonts,
  NOTE_CARD_HEIGHT,
  NOTE_CARD_WIDTH,
  noteCardToDataUrl,
} from '../../lib/noteCard.js';

const imageCache = new Map();

function cacheKey(note, scale) {
  return `${note.id || 'note'}:${note.body?.length || 0}:${note.guests?.full_name || ''}:${scale}`;
}

/**
 * Renders a note to a PNG data URL once per note/scale and memoises it, so a
 * grid of tiles pays for a small preview while the viewer pays for a large one.
 */
export function useNoteCardImage(note, scale = 2) {
  const key = note ? cacheKey(note, scale) : null;
  const [src, setSrc] = useState(() => (key ? imageCache.get(key) || null : null));

  useEffect(() => {
    if (!note || !key) return undefined;
    const cached = imageCache.get(key);
    if (cached) {
      setSrc(cached);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      await ensureNoteCardFonts();
      if (cancelled) return;
      try {
        const canvas = createNoteCardCanvas(
          {
            id: note.id,
            body: note.body,
            createdAt: note.created_at,
            guestName: note.guests?.full_name,
          },
          { scale },
        );
        const url = noteCardToDataUrl(canvas, { format: 'png' });
        imageCache.set(key, url);
        if (!cancelled) setSrc(url);
      } catch {
        if (!cancelled) setSrc(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [key, note, scale]);

  return src;
}

/** Square gallery tile: the whole card, fitted, with a paper backing. */
export function NoteCardTile({ note, onOpen, author }) {
  const src = useNoteCardImage(note, 0.5);
  const name = author || note.guests?.full_name || 'A guest';

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Open the note from ${name}`}
      className="group relative aspect-square overflow-hidden rounded-xl border border-brown/10 bg-beige p-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
    >
      {src ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          className="h-full w-full object-contain transition duration-200 group-hover:scale-[1.02]"
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-2xl text-brown/30" aria-hidden="true">
          ❦
        </span>
      )}
      <span className="absolute left-1.5 top-1.5 rounded-full bg-brown-dark/70 px-2 py-0.5 text-[9px] uppercase tracking-[0.12em] text-cream backdrop-blur">
        Note
      </span>
    </button>
  );
}

/** Full-size card with PNG / JPG export. */
export default function NoteCardViewer({ note, author, onClose }) {
  const src = useNoteCardImage(note, 1);
  const [busy, setBusy] = useState(null);

  const save = async (format) => {
    setBusy(format);
    try {
      await downloadNoteCard(
        {
          id: note.id,
          body: note.body,
          createdAt: note.created_at,
          guestName: note.guests?.full_name || author,
        },
        { format, scale: 2 },
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal open={Boolean(note)} onClose={onClose} title={author || note?.guests?.full_name || 'A note'} size="lg">
      {note && (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-brown/10 bg-beige p-2">
            {src ? (
              <img src={src} alt={`Note from ${author || 'a guest'}`} className="mx-auto w-full rounded-xl" />
            ) : (
              <div className="flex aspect-[5/7] items-center justify-center text-brown/40">Drawing the card…</div>
            )}
          </div>

          <p className="text-center text-xs text-brown/50">
            High-resolution keepsake — {NOTE_CARD_WIDTH * 2} × {NOTE_CARD_HEIGHT * 2} px
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => save('png')}
              disabled={Boolean(busy)}
              className="oge-btn-primary flex-1"
            >
              {busy === 'png' ? 'Preparing…' : 'Save PNG'}
            </button>
            <button
              type="button"
              onClick={() => save('jpg')}
              disabled={Boolean(busy)}
              className="flex-1 rounded-full border border-brown/20 px-4 py-2 text-sm text-brown transition hover:border-gold disabled:opacity-40"
            >
              {busy === 'jpg' ? 'Preparing…' : 'Save JPG'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
