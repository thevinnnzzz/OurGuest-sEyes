import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import JSZip from 'jszip';
import DownloadModal from '../src/components/wedding/DownloadModal.jsx';
import GuestAlbums from '../src/components/wedding/GuestAlbums.jsx';
import { buildGalleryZip } from '../src/lib/downloads.js';

const media = [
  { id: 'm1', guest_id: 'g1', type: 'photo', url: 'https://picsum.photos/seed/dl-a/400/500', filter_name: 'none', created_at: '2026-11-01T18:00:00Z' },
  { id: 'm2', guest_id: 'g2', type: 'video', url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4', filter_name: null, created_at: '2026-11-01T17:00:00Z' },
];
const notes = [
  { id: 'n1', guest_id: 'g1', body: 'Thank you for the most beautiful day.', created_at: '2026-11-01T19:00:00Z', guests: { full_name: 'Ada Okonjo' } },
  { id: 'n2', guest_id: 'g2', body: 'What a wedding.', created_at: '2026-11-01T19:10:00Z', guests: { full_name: null } },
];
const guestNameById = { g1: 'Ada Okonjo', g2: null };

async function entriesOf(blob) {
  const zip = await JSZip.loadAsync(blob);
  return Object.keys(zip.files).filter((path) => !zip.files[path].dir);
}

function Harness() {
  const [open, setOpen] = useState(true);
  const [progress, setProgress] = useState(null);
  const [result, setResult] = useState(null);

  const onDownload = async (filter) => {
    setProgress({ done: 0, total: 0, label: 'Packing…' });
    try {
      const archive = await buildGalleryZip({ media, notes, filter, guestNameById, onProgress: setProgress });
      setResult({ total: archive.total, included: archive.included, failures: archive.failures.length, entries: await entriesOf(archive.blob), sizeKB: Math.round(archive.blob.size / 1024) });
    } catch (error) {
      setResult({ error: error.message });
    } finally {
      setProgress(null);
    }
  };

  return (
    <div className="bg-cream p-2">
      <DownloadModal open={open} onClose={() => setOpen(false)} media={media} notes={notes} busy={Boolean(progress)} progress={progress} result={result} onDownload={onDownload} />
      <div id="state" className="text-xs">{JSON.stringify(result)}</div>
      <GuestAlbums media={media} notes={notes} guestNameById={guestNameById} likes={[]} session={{ guestId: 'g1' }} onUpload={() => {}} onToggleLike={() => {}} onDownload={() => {}} />
    </div>
  );
}

createRoot(document.getElementById('root')).render(<Harness />);
