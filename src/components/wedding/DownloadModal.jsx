import { useEffect, useState } from 'react';
import Modal from '../ui/Modal.jsx';
import { DOWNLOAD_FILTERS, downloadCounts } from '../../lib/downloads.js';

function optionCount(id, counts) {
  if (id === 'media') return counts.media;
  if (id === 'notes') return counts.notes;
  return counts.all;
}

/**
 * Global "Save All" options. The radios are exactly the three supported
 * filters; anything with nothing behind it is disabled rather than silently
 * producing an empty archive.
 */
export default function DownloadModal({ open, onClose, media = [], notes = [], busy = false, progress = null, result = null, onDownload }) {
  const [filter, setFilter] = useState('all');
  const counts = downloadCounts({ media, notes });

  useEffect(() => {
    if (open) setFilter(counts.media > 0 ? 'all' : 'notes');
  }, [open, counts.media]);

  const selected = optionCount(filter, counts);
  const percent = progress && progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      title="Save the keepsake"
      size="md"
    >
      {result ? (
        <div className="space-y-4">
          <p className="text-sm text-brown">
            {result.error
              ? result.error
              : result.failures
                ? `Saved ${result.included} of ${result.total} items. ${result.failures} could not be fetched.`
                : `Saved all ${result.total} item${result.total === 1 ? '' : 's'} to your downloads.`}
          </p>
          {result.fileName && <p className="text-xs text-brown/50">{result.fileName}</p>}
          <button type="button" className="oge-btn-primary w-full" onClick={onClose}>
            Done
          </button>
        </div>
      ) : busy ? (
        <div className="space-y-3">
          <div className="h-3 overflow-hidden rounded-full bg-beige">
            <div className="h-full bg-gold transition-all" style={{ width: `${percent}%` }} />
          </div>
          <p className="text-center text-xs text-brown/60">{progress?.label || 'Packing…'}</p>
          <p className="text-center text-[11px] text-brown/40">
            Keep this open until the archive finishes.
          </p>
        </div>
      ) : (
        <>
          <p className="mb-3 text-sm text-brown/70">
            Choose what to pack. Note cards are rendered as their full-resolution PNG.
          </p>

          <div role="radiogroup" aria-label="Download filter" className="space-y-2">
            {DOWNLOAD_FILTERS.map((option) => {
              const count = optionCount(option.id, counts);
              const disabled = count === 0;
              const checked = filter === option.id;
              return (
                <label
                  key={option.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition ${
                    checked ? 'border-gold bg-gold/10' : 'border-brown/15 bg-white hover:border-brown/30'
                  } ${disabled ? 'cursor-not-allowed opacity-40' : ''}`}
                >
                  <input
                    type="radio"
                    name="download-filter"
                    value={option.id}
                    checked={checked}
                    disabled={disabled}
                    onChange={() => setFilter(option.id)}
                    className="h-4 w-4 accent-[#6B4F3A]"
                  />
                  <span className="text-sm text-brown-dark">{option.label}</span>
                  <span className="ml-auto text-xs text-brown/50">
                    {count} item{count === 1 ? '' : 's'}
                  </span>
                </label>
              );
            })}
          </div>

          <p className="mt-3 text-[11px] text-brown/45">
            {counts.photos} photo{counts.photos === 1 ? '' : 's'} · {counts.videos} video
            {counts.videos === 1 ? '' : 's'} · {counts.notes} note card{counts.notes === 1 ? '' : 's'}
          </p>

          <button
            type="button"
            className="oge-btn-primary mt-4 w-full"
            disabled={selected === 0}
            onClick={() => onDownload(filter)}
          >
            Download {selected} item{selected === 1 ? '' : 's'}
          </button>
        </>
      )}
    </Modal>
  );
}
