export default function Spinner({ className = '', label = 'Loading…' }) {
  return (
    <div className={`flex flex-col items-center gap-3 py-10 text-brown/70 ${className}`} role="status">
      <svg className="h-8 w-8 animate-spin" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
        <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <span className="text-sm tracking-wide">{label}</span>
    </div>
  );
}
