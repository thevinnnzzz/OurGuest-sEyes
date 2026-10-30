export default function EmptyState({ icon = '🌸', title, subtitle, children }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-brown/25 bg-white/50 px-6 py-12 text-center">
      <span className="text-3xl" aria-hidden>{icon}</span>
      <h3 className="font-display text-lg font-semibold text-brown">{title}</h3>
      {subtitle && <p className="max-w-xs text-sm text-brown/60">{subtitle}</p>}
      {children}
    </div>
  );
}
