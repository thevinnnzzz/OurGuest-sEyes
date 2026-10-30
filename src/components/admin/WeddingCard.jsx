import dayjs from 'dayjs';

const STATUS_STYLES = {
  live: 'bg-green-100 text-green-800 border-green-300',
  upcoming: 'bg-gold/20 text-brown border-gold',
  expired: 'bg-rose/15 text-rose-dark border-rose/40',
};

export default function WeddingCard({ wedding, stats, onConfigure, onQr, onView }) {
  const names = [wedding.couple_name_1, wedding.couple_name_2].filter(Boolean).join(' & ');
  const status = (wedding.status || 'live');

  const daysLeft = wedding.expires_at
    ? Math.max(0, Math.ceil((new Date(wedding.expires_at) - new Date()) / 86400000))
    : null;

  return (
    <article className="oge-card flex flex-col overflow-hidden">
      <div className="relative h-36 bg-beige">
        {wedding.cover_image_url ? (
          <img src={wedding.cover_image_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-3xl text-rose/60">❦</div>
        )}
        <span
          className={`absolute right-3 top-3 rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${STATUS_STYLES[status] || STATUS_STYLES.live}`}
        >
          {status}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="font-display text-lg font-semibold text-brown">{names}</h3>
          <p className="text-xs text-brown/60">{dayjs(wedding.wedding_date).format('dddd, D MMM YYYY')}</p>
        </div>

        {stats && (
          <dl className="grid grid-cols-4 gap-1 rounded-xl bg-beige/50 p-2 text-center">
            {[
              ['Guests', stats.guests],
              ['Media', stats.media],
              ['Likes', stats.likes],
              ['Notes', stats.messages],
            ].map(([label, val]) => (
              <div key={label}>
                <dd className="font-display text-base font-bold text-brown">{val ?? 0}</dd>
                <dt className="text-[9px] uppercase tracking-[0.14em] text-brown/55">{label}</dt>
              </div>
            ))}
          </dl>
        )}

        {status === 'live' && daysLeft != null && (
          <p className="text-xs text-rose-dark">Window closes in {daysLeft} day{daysLeft === 1 ? '' : 's'}</p>
        )}

        <div className="mt-auto grid grid-cols-3 gap-2">
          <button type="button" className="oge-btn-outline px-2 py-2 text-xs" onClick={onConfigure}>
            Configure
          </button>
          <button type="button" className="oge-btn-outline px-2 py-2 text-xs" onClick={onQr}>
            QR code
          </button>
          <button type="button" className="oge-btn-primary px-2 py-2 text-xs" onClick={onView}>
            View
          </button>
        </div>
      </div>
    </article>
  );
}
