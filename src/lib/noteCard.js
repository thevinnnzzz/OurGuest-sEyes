/**
 * Guest notes → vintage paper cards, drawn entirely with the Canvas 2D API.
 *
 * No texture images, no SVG filters, no HTML-to-image library: the parchment is
 * built from gradients, seeded speckle, fibre strokes and a tiled noise pattern,
 * and the type uses the fonts the app already loads (Great Vibes, Cormorant
 * Garamond, Jost). Cards are deterministic — the same note always renders the
 * same paper — and export strictly as PNG or JPEG.
 */

export const NOTE_CARD_WIDTH = 1000;
export const NOTE_CARD_HEIGHT = 1400;

const PALETTE = {
  cream: '#FAF6EF',
  beige: '#F1E8DA',
  sand: '#E5D5BD',
  brown: '#6B4F3A',
  brownDark: '#4A3527',
  gold: '#C9A96A',
  ink: '#3D3229',
  rose: '#C98A8A',
};

const FONT_BODY = '"Cormorant Garamond", Georgia, "Times New Roman", serif';
const FONT_SCRIPT = '"Great Vibes", "Segoe Script", cursive';
const FONT_SANS = 'Jost, system-ui, sans-serif';

/* ------------------------------------------------------------------ *
 * Deterministic randomness — same note id, same paper.
 * ------------------------------------------------------------------ */

export function hashSeed(input = '') {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ *
 * Fonts
 * ------------------------------------------------------------------ */

const FONT_LOADS = [
  `italic 400 44px ${FONT_BODY}`,
  `400 46px ${FONT_SCRIPT}`,
  `700 46px ${FONT_SCRIPT}`,
  `400 22px ${FONT_SANS}`,
  `500 22px ${FONT_SANS}`,
];

/**
 * Waits for the three families to be usable by canvas text. Resolves even when a
 * family is missing (the canvas falls back to the CSS fallback stack), it never
 * fabricates a font that isn't there.
 */
export async function ensureNoteCardFonts() {
  if (typeof document === 'undefined' || !document.fonts) return false;
  try {
    await Promise.all(FONT_LOADS.map((font) => document.fonts.load(font).catch(() => null)));
    await document.fonts.ready;
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ *
 * Parchment
 * ------------------------------------------------------------------ */

let noisePatternSource = null;

function noisePattern(ctx) {
  if (!noisePatternSource) {
    const tile = document.createElement('canvas');
    tile.width = 96;
    tile.height = 96;
    const tctx = tile.getContext('2d');
    const image = tctx.createImageData(96, 96);
    const rand = mulberry32(0x9e3779b9);
    // Few discrete alpha steps keep the grain visible but the PNG compressible.
    const alphas = [0, 0, 4, 8, 12, 16];
    for (let i = 0; i < image.data.length; i += 4) {
      image.data[i] = 158;
      image.data[i + 1] = 132;
      image.data[i + 2] = 104;
      image.data[i + 3] = alphas[Math.floor(rand() * alphas.length)];
    }
    tctx.putImageData(image, 0, 0);
    noisePatternSource = tile;
  }

  const pattern = ctx.createPattern(noisePatternSource, 'repeat');
  if (pattern && typeof pattern.setTransform === 'function' && typeof DOMMatrix !== 'undefined') {
    // Coarser flecks (≈1.8 device px each) read as paper rather than sensor noise.
    pattern.setTransform(new DOMMatrix([1.8, 0, 0, 1.8, 0, 0]));
  }
  return pattern;
}

/** Irregular, softly torn edge around the sheet. */
function paperEdgePath(ctx, width, height, rand) {
  const inset = 18;
  const step = 26;
  const wobble = 7;
  ctx.beginPath();
  const edge = (from, to, axis) => {
    const points = [];
    for (let value = from; value <= to; value += step) points.push(value);
    points.push(to);
    return points;
  };

  const top = edge(inset, width - inset, 'x');
  ctx.moveTo(top[0], inset + (rand() - 0.5) * wobble);
  top.forEach((x) => ctx.lineTo(x, inset + (rand() - 0.5) * wobble * 2));

  const right = edge(inset, height - inset, 'y');
  right.forEach((y) => ctx.lineTo(width - inset + (rand() - 0.5) * wobble * 2, y));

  const bottom = edge(width - inset, inset, 'x');
  bottom.forEach((x) => ctx.lineTo(x, height - inset + (rand() - 0.5) * wobble * 2));

  const left = edge(height - inset, inset, 'y');
  left.forEach((y) => ctx.lineTo(inset + (rand() - 0.5) * wobble * 2, y));

  ctx.closePath();
}

function paintPaper(ctx, width, height, rand) {
  const base = ctx.createLinearGradient(0, 0, width * 0.4, height);
  base.addColorStop(0, '#FBF7F0');
  base.addColorStop(0.45, PALETTE.cream);
  base.addColorStop(0.78, PALETTE.beige);
  base.addColorStop(1, PALETTE.sand);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, width, height);

  // Aged blotches — overlapping low-alpha radials read as foxing.
  for (let i = 0; i < 26; i += 1) {
    const x = rand() * width;
    const y = rand() * height;
    const radius = 60 + rand() * 240;
    const blot = ctx.createRadialGradient(x, y, 0, x, y, radius);
    blot.addColorStop(0, `rgba(150, 118, 84, ${0.03 + rand() * 0.05})`);
    blot.addColorStop(1, 'rgba(150, 118, 84, 0)');
    ctx.fillStyle = blot;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  // Fibres.
  ctx.lineWidth = 1;
  for (let i = 0; i < 70; i += 1) {
    const x = rand() * width;
    const y = rand() * height;
    const length = 18 + rand() * 90;
    const drift = (rand() - 0.5) * 26;
    ctx.strokeStyle = `rgba(120, 92, 66, ${0.02 + rand() * 0.04})`;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + length / 2, y + drift, x + length, y + drift * 0.4);
    ctx.stroke();
  }

  // Fine grain, tiled from a 128px seeded tile.
  const pattern = noisePattern(ctx);
  if (pattern) {
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  // Edge darkening.
  const vignette = ctx.createRadialGradient(
    width / 2,
    height / 2,
    height * 0.28,
    width / 2,
    height / 2,
    height * 0.78,
  );
  vignette.addColorStop(0, 'rgba(74, 53, 39, 0)');
  vignette.addColorStop(0.72, 'rgba(74, 53, 39, 0.06)');
  vignette.addColorStop(1, 'rgba(74, 53, 39, 0.2)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
}

function paintRules(ctx, width, height) {
  const inset = 46;
  ctx.strokeStyle = 'rgba(107, 79, 58, 0.28)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(inset, inset, width - inset * 2, height - inset * 2);

  ctx.strokeStyle = 'rgba(201, 169, 106, 0.45)';
  ctx.lineWidth = 1;
  ctx.strokeRect(inset + 8, inset + 8, width - (inset + 8) * 2, height - (inset + 8) * 2);
}

/** Small drawn flourish: two mirrored curves and a diamond. */
function paintFlourish(ctx, cx, y, width = 150) {
  ctx.save();
  ctx.strokeStyle = 'rgba(107, 79, 58, 0.5)';
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  const half = width / 2;
  [1, -1].forEach((direction) => {
    ctx.beginPath();
    ctx.moveTo(cx + direction * 10, y);
    ctx.bezierCurveTo(
      cx + direction * half * 0.5,
      y - 10,
      cx + direction * half * 0.7,
      y + 10,
      cx + direction * half,
      y,
    );
    ctx.stroke();
  });
  ctx.fillStyle = 'rgba(201, 169, 106, 0.85)';
  ctx.beginPath();
  ctx.moveTo(cx, y - 5);
  ctx.lineTo(cx + 5, y);
  ctx.lineTo(cx, y + 5);
  ctx.lineTo(cx - 5, y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/* ------------------------------------------------------------------ *
 * Type
 * ------------------------------------------------------------------ */

function wrapLines(ctx, text, maxWidth) {
  const paragraphs = String(text).replace(/\r\n/g, '\n').split('\n');
  const lines = [];

  paragraphs.forEach((paragraph, paragraphIndex) => {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) {
      if (paragraphIndex > 0) lines.push('');
      return;
    }
    let current = '';
    words.forEach((word) => {
      const candidate = current ? `${current} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidth) {
        current = candidate;
        return;
      }
      if (current) lines.push(current);
      if (ctx.measureText(word).width <= maxWidth) {
        current = word;
        return;
      }
      // A single unbroken word wider than the page: split it by characters.
      let chunk = '';
      for (const char of word) {
        if (ctx.measureText(chunk + char).width > maxWidth) {
          lines.push(chunk);
          chunk = char;
        } else {
          chunk += char;
        }
      }
      current = chunk;
    });
    if (current) lines.push(current);
  });

  return lines;
}

function fitBody(ctx, text, { maxWidth, maxHeight }) {
  const sizes = [44, 41, 38, 35, 32, 29, 26];
  let best = null;

  for (const size of sizes) {
    ctx.font = `italic 400 ${size}px ${FONT_BODY}`;
    const lines = wrapLines(ctx, text, maxWidth);
    const lineHeight = Math.round(size * 1.55);
    const height = lines.length * lineHeight;
    best = { size, lineHeight, lines, height };
    if (height <= maxHeight) return best;
  }

  // Longer than one card can hold: keep whole lines and ellipsize.
  const maxLines = Math.max(1, Math.floor(maxHeight / best.lineHeight));
  if (best.lines.length > maxLines) {
    const lines = best.lines.slice(0, maxLines);
    const last = lines[maxLines - 1];
    let trimmed = last;
    while (trimmed.length > 1 && ctx.measureText(`${trimmed}…`).width > maxWidth) {
      trimmed = trimmed.slice(0, -1);
    }
    lines[maxLines - 1] = `${trimmed.trimEnd()}…`;
    best.lines = lines;
    best.height = lines.length * best.lineHeight;
  }
  return best;
}

function drawTracked(ctx, text, x, y, tracking, align = 'center') {
  const chars = [...text];
  const widths = chars.map((char) => ctx.measureText(char).width + Math.max(0, tracking));
  const total = widths.reduce((sum, value) => sum + value, 0) - Math.max(0, tracking);
  let cursor = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  ctx.textAlign = 'left';
  chars.forEach((char, index) => {
    ctx.fillText(char, cursor, y);
    cursor += widths[index];
  });
}

function formatNoteDate(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

/* ------------------------------------------------------------------ *
 * Render
 * ------------------------------------------------------------------ */

function drawCard(ctx, { text, guestName, createdAt }, width, height, seed) {
  const rand = mulberry32(seed);

  ctx.save();
  paperEdgePath(ctx, width, height, rand);
  ctx.clip();
  paintPaper(ctx, width, height, rand);
  ctx.restore();

  paintRules(ctx, width, height);

  const centerX = width / 2;
  const bodyX = 118;
  const bodyWidth = width - bodyX * 2;

  // Heading: a script line + flourish.
  ctx.fillStyle = 'rgba(107, 79, 58, 0.9)';
  ctx.font = `400 62px ${FONT_SCRIPT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('A note for you', centerX, 214);
  paintFlourish(ctx, centerX, 252, 190);

  // Body copy.
  const bodyTop = 330;
  const bodyBottom = height - 360;
  const body = fitBody(ctx, text, { maxWidth: bodyWidth, maxHeight: bodyBottom - bodyTop });

  ctx.fillStyle = PALETTE.ink;
  ctx.font = `italic 400 ${body.size}px ${FONT_BODY}`;
  ctx.textAlign = 'center';
  let cursorY = bodyTop + body.lineHeight * 0.8;
  body.lines.forEach((line) => {
    if (line) ctx.fillText(line, centerX, cursorY);
    cursorY += body.lineHeight;
  });

  // Signature.
  const signature = (guestName || 'A guest').trim();
  ctx.fillStyle = 'rgba(61, 50, 41, 0.92)';
  ctx.font = `400 48px ${FONT_SCRIPT}`;
  ctx.textAlign = 'right';
  ctx.fillText(signature, width - bodyX, height - 190);

  ctx.strokeStyle = 'rgba(107, 79, 58, 0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(width - bodyX - 210, height - 172);
  ctx.lineTo(width - bodyX, height - 172);
  ctx.stroke();

  // Date, top-left of the footer.
  const dateLabel = formatNoteDate(createdAt).toUpperCase();
  ctx.fillStyle = 'rgba(107, 79, 58, 0.55)';
  ctx.font = `400 19px ${FONT_SANS}`;
  drawTracked(ctx, dateLabel, bodyX, height - 176, 2.4, 'left');

  // Fleuron + wordmark.
  ctx.fillStyle = 'rgba(201, 169, 106, 0.9)';
  ctx.font = `400 34px ${FONT_BODY}`;
  ctx.textAlign = 'center';
  ctx.fillText('❦', centerX, height - 108);

  ctx.fillStyle = 'rgba(107, 79, 58, 0.45)';
  ctx.font = `500 16px ${FONT_SANS}`;
  drawTracked(ctx, 'OUR GUESTS’ EYES', centerX, height - 74, 3.6, 'center');
}

/**
 * Draws a note card synchronously. Call `ensureNoteCardFonts()` first if the
 * card must use the webfonts rather than the fallback stack.
 */
export function renderNoteCard(ctx, note, { scale = 1, width = NOTE_CARD_WIDTH, height = NOTE_CARD_HEIGHT } = {}) {
  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, width, height);
  drawCard(
    ctx,
    {
      text: String(note?.body ?? note?.text ?? ''),
      guestName: note?.guestName || note?.guests?.full_name || note?.guest_name || '',
      createdAt: note?.createdAt || note?.created_at,
    },
    width,
    height,
    hashSeed(String(note?.id || note?.body || 'note')),
  );
  ctx.restore();
}

/** Builds the card on a detached canvas at `scale`× the 1000×1400 layout. */
export function createNoteCardCanvas(note, { scale = 2 } = {}) {
  if (typeof document === 'undefined') throw new Error('Note cards need a browser canvas');
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(NOTE_CARD_WIDTH * scale);
  canvas.height = Math.round(NOTE_CARD_HEIGHT * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is unavailable in this browser');
  renderNoteCard(ctx, note, { scale });
  return canvas;
}

/* ------------------------------------------------------------------ *
 * Export — PNG or JPEG only.
 * ------------------------------------------------------------------ */

const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg' };

function normalizeFormat(format = 'png') {
  const key = String(format).toLowerCase().replace('image/', '');
  const mime = MIME[key];
  if (!mime) throw new TypeError(`Note cards export as PNG or JPEG only (got "${format}")`);
  return { mime, extension: mime === 'image/jpeg' ? 'jpg' : 'png' };
}

/** JPEG has no alpha, so the torn edge is flattened onto the paper colour. */
function flattenForJpeg(canvas) {
  const flat = document.createElement('canvas');
  flat.width = canvas.width;
  flat.height = canvas.height;
  const ctx = flat.getContext('2d');
  ctx.fillStyle = PALETTE.cream;
  ctx.fillRect(0, 0, flat.width, flat.height);
  ctx.drawImage(canvas, 0, 0);
  return flat;
}

export function noteCardToBlob(canvas, { format = 'png', quality = 0.92 } = {}) {
  const { mime } = normalizeFormat(format);
  const source = mime === 'image/jpeg' ? flattenForJpeg(canvas) : canvas;
  return new Promise((resolve, reject) => {
    source.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not encode the note card'))),
      mime,
      quality,
    );
  });
}

export function noteCardToDataUrl(canvas, { format = 'png', quality = 0.92 } = {}) {
  const { mime } = normalizeFormat(format);
  const source = mime === 'image/jpeg' ? flattenForJpeg(canvas) : canvas;
  return source.toDataURL(mime, quality);
}

export function noteCardFileName(note, format = 'png') {
  const { extension } = normalizeFormat(format);
  const who = (note?.guestName || note?.guests?.full_name || 'guest')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'guest';
  const stamp = String(note?.createdAt || note?.created_at || new Date().toISOString()).slice(0, 10);
  return `note-${who}-${stamp}.${extension}`;
}

/** Renders at `scale`× and hands the file to the browser as a download. */
export async function downloadNoteCard(note, { format = 'png', scale = 2, quality = 0.92 } = {}) {
  const { extension } = normalizeFormat(format);
  await ensureNoteCardFonts();
  const canvas = createNoteCardCanvas(note, { scale });
  const blob = await noteCardToBlob(canvas, { format, quality });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = noteCardFileName(note, extension);
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return { blob, fileName: link.download, width: canvas.width, height: canvas.height };
}
