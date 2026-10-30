import { PHOTO_FILTERS, filterCss } from '../../lib/constants.js';

export default function FilterPicker({ value, onChange }) {
  const preview = value;

  return (
    <div className="space-y-3">
      <p className="oge-label">Add a touch of film magic (optional, live CSS filters)</p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {PHOTO_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => onChange(f.id)}
            className={`group rounded-xl border p-1 transition ${
              preview === f.id ? 'border-gold ring-1 ring-gold' : 'border-brown/15 hover:border-brown/40'
            }`}
          >
            <div
              className="h-14 w-full rounded-lg bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22140%22><rect width=%22200%22 height=%22140%22 fill=%22%23E5D5BD%22/><circle cx=%2270%22 cy=%2280%22 r=%2230%22 fill=%22%23C98A8A%22/><circle cx=%22120%22 cy=%2260%22 r=%2218%22 fill=%22%23C9A96A%22/></svg>')] bg-cover bg-center"
              style={{ filter: filterCss(f.id) }}
            />
            <span className="mt-1 block truncate text-[10px] tracking-wide text-brown/80">{f.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
