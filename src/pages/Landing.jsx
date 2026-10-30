import { Link } from 'react-router-dom';

export default function Landing() {
  return (
    <div className="min-h-dvh bg-cream">
      {/* Hero */}
      <header className="relative overflow-hidden px-5 py-20 text-center">
        <div aria-hidden className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-rose/10 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-gold/10 blur-3xl" />
        <p className="text-[11px] uppercase tracking-[0.35em] text-brown/60">Every angle. Every tear. Every toast.</p>
        <h1 className="mt-4 font-display text-4xl font-bold leading-tight text-brown sm:text-5xl">
          See your wedding through <span className="font-script text-5xl text-rose">Our Guests' Eyes</span>
        </h1>
        <p className="mx-auto mt-5 max-w-lg font-body text-lg leading-relaxed text-brown/75">
          One QR code on every table. Your guests' phones become your wedding album — photos, videos, and
          beautiful letters from everyone you love, kept safe for 3 days of celebrating... and yours forever.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link to="/admin/login" className="oge-btn-primary">Open the Dashboard</Link>
          <Link to="/partner" className="oge-btn-outline">Partner with us</Link>
        </div>
      </header>

      {/* How it works */}
      <section className="mx-auto grid max-w-4xl gap-5 px-5 pb-16 sm:grid-cols-3">
        {[
          ['1 · The code', 'We print one elegant QR code for every table. Guests scan, say their name, and step right in.'],
          ['2 · The flood of love', 'Guests upload up to 10 photos & 5 videos, filter them with vintage film looks, and comment as the day unfolds.'],
          ['3 · The keepsake', 'After the date, the couple keeps everything. Gallery closes and all media is purged 3 days later — nothing lingers.'],
        ].map(([t, d]) => (
          <div key={t} className="oge-card p-6 text-center">
            <h3 className="font-display text-lg font-semibold text-brown">{t}</h3>
            <p className="mt-2 text-sm leading-relaxed text-brown/70">{d}</p>
          </div>
        ))}
      </section>

      {/* Partnership */}
      <footer id="partnerships" className="border-t border-brown/10 bg-beige/60 px-5 py-14">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="font-display text-2xl font-semibold text-brown">Restaurants. Wedding venues. Coordinators.</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-brown/70">
            Offer every couple a digital wedding album as part of your package. Our team will set everything up in minutes.
          </p>
          <Link to="/partner" className="oge-btn-gold mt-6">Inquire about partnership</Link>
          <p className="mt-8 font-script text-3xl text-rose">Our Guests' Eyes</p>
          <p className="mt-1 text-xs tracking-[0.2em] text-brown/50">seen through the lens that was there</p>
        </div>
      </footer>
    </div>
  );
}
