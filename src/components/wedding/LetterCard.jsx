import { useRef, useState } from 'react';
import dayjs from 'dayjs';

const PARCHMENT_CSS = {
  background:
    'radial-gradient(ellipse at top left, rgba(107,79,58,0.08), transparent 55%), radial-gradient(ellipse at bottom right, rgba(201,138,138,0.10), transparent 50%), linear-gradient(160deg, #F7EFDF 0%, #F3E8D2 30%, #EFE3C9 70%, #E9DABB 100%)',
};

export default function LetterCard({ message, author, date }) {
  const cardRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const saveKeepsake = async () => {
    setSaving(true);
    try {
      const canvas = document.createElement('canvas');
      const W = 700;
      const rect = cardRef.current.getBoundingClientRect();
      const H = Math.max(rect.height, 220);
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');

      // parchment base
      const grad = ctx.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0, '#F7EFDF');
      grad.addColorStop(0.5, '#EFE3C9');
      grad.addColorStop(1, '#E9DABB');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(107,79,58,0.25)';
      ctx.setLineDash([6, 5]);
      ctx.strokeRect(14, 14, W - 28, H - 28);
      ctx.setLineDash([]);

      // text
      ctx.fillStyle = '#4A3527';
      ctx.font = '24px "Great Vibes", cursive';
      ctx.textBaseline = 'top';

      const body = message.body;
      const maxLine = 560;
      const lines = [];
      let line = '';
      for (const word of body.split(' ')) {
        const test = line ? `${line} ${word}` : word;
        if (ctx.measureText(test).width > maxLine) {
          lines.push(line);
          line = word;
        } else {
          line = test;
        }
      }
      if (line) lines.push(line);

      let y = 48;
      for (const l of lines) {
        ctx.fillText(l, 48, y);
        y += 40;
      }
      ctx.font = 'italic 20px "Cormorant Garamond", serif';
      ctx.fillText(`— ${author}`, 48, H - 88);
      ctx.font = '16px "Cormorant Garamond", serif';
      ctx.fillStyle = 'rgba(74,53,39,0.65)';
      if (date) ctx.fillText(dayjs(date).format('D MMMM YYYY'), 48, H - 58);

      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `letter-${author.replace(/\s+/g, '-').toLowerCase()}.png`;
      a.click();
    } finally {
      setSaving(false);
    }
  };

  return (
    <article ref={cardRef} className="oge-letter relative p-5" style={PARCHMENT_CSS}>
      <button
        type="button"
        onClick={saveKeepsake}
        className="absolute right-3 top-3 rounded-full border border-brown/30 bg-white/40 px-3 py-1 text-xs text-brown transition hover:bg-white/80"
        disabled={saving}
      >
        {saving ? 'Saving…' : '♡ Keep'}
      </button>

      <p
        className={`pr-12 font-script text-2xl leading-relaxed text-brown-dark ${expanded ? '' : 'line-clamp-6'}`}
        onClick={() => setExpanded((v) => !v)}
      >
        “{message.body}”
      </p>
      <footer className="mt-4 flex items-end justify-between">
        <span className="font-body text-base italic text-brown/80">— {author}</span>
        {date && (
          <span className="text-[11px] uppercase tracking-[0.14em] text-brown/50">
            {dayjs(date).format('D MMM YYYY')}
          </span>
        )}
      </footer>
    </article>
  );
}
