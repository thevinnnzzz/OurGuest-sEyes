import dayjs from 'dayjs';

export default function Hero({ wedding, couplesSince }) {
  const names = [wedding.couple_name_1, wedding.couple_name_2].filter(Boolean).join(' & ');
  const date = wedding.wedding_date ? dayjs(wedding.wedding_date).format('dddd, D MMMM YYYY') : '';

  return (
    <header className="relative overflow-hidden">
      {wedding.cover_image_url && (
        <div className="absolute inset-0 -z-10">
          <img src={wedding.cover_image_url} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-brown-dark/60 via-brown-dark/30 to-cream" />
        </div>
      )}
      <div className={`px-4 py-14 text-center ${wedding.cover_image_url ? 'text-cream' : ''}`}>
        <p className="text-[11px] uppercase tracking-[0.3em] opacity-80">Forever begins</p>
        <h1 className="mt-3 font-script text-5xl leading-tight drop-shadow-sm sm:text-6xl">
          {names || 'A Celebration'}
        </h1>
        {date && (
          <p className={`mt-3 font-display text-sm tracking-[0.2em] ${wedding.cover_image_url ? 'text-cream/90' : 'text-brown/70'}`}>
            {date.toUpperCase()}
          </p>
        )}
        <div className="oge-divider !my-5">✦</div>
        {wedding.message && (
          <p className={`mx-auto max-w-md font-body text-base italic ${wedding.cover_image_url ? 'text-cream/90' : 'text-brown/80'}`}>
            “{wedding.message}”
          </p>
        )}
        {couplesSince != null && (
          <p className={`mt-6 text-xs tracking-wide ${wedding.cover_image_url ? 'text-cream/75' : 'text-brown/60'}`}>
            {couplesSince} moment{couplesSince === 1 ? '' : 's'} captured through our guests' eyes
          </p>
        )}
      </div>
    </header>
  );
}
