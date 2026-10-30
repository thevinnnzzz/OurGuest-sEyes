import { CardsIcon, GridIcon, NoteIcon, PlayIcon, PlusIcon } from './icons.jsx';

export const TABS = [
  { id: 'photos', label: 'Photos', Icon: GridIcon },
  { id: 'reels', label: 'Reels', Icon: PlayIcon },
  { id: 'notes', label: 'Notes', Icon: NoteIcon },
  { id: 'gallery', label: 'Gallery', Icon: CardsIcon },
];

export default function BottomNav({ active, onChange, onUpload, uploadDisabled = false }) {
  const tabButton = ({ id, label, Icon }) => {
    const isActive = active === id;
    return (
      <button
        key={id}
        type="button"
        onClick={() => onChange(id)}
        aria-current={isActive ? 'page' : undefined}
        className={`flex h-full flex-1 flex-col items-center justify-center gap-1 transition ${
          isActive ? 'text-brown-dark' : 'text-brown/45 hover:text-brown/70'
        }`}
      >
        <Icon className={`h-6 w-6 ${isActive ? '[stroke-width:2.3]' : ''}`} />
        <span className="text-[10px] font-medium tracking-wide">{label}</span>
        <span className={`h-1 w-1 rounded-full ${isActive ? 'bg-brown-dark' : 'bg-transparent'}`} />
      </button>
    );
  };

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-brown/10 bg-cream/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto flex h-[var(--oge-nav-h)] max-w-[470px] items-stretch px-1">
        {TABS.slice(0, 2).map(tabButton)}

        <div className="flex flex-1 items-center justify-center">
          <button
            type="button"
            onClick={onUpload}
            disabled={uploadDisabled}
            aria-label="Share a moment"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-brown/20 bg-white text-brown shadow-card transition hover:border-gold hover:text-gold disabled:opacity-40"
          >
            <PlusIcon className="h-6 w-6" />
          </button>
        </div>

        {TABS.slice(2).map(tabButton)}
      </div>
    </nav>
  );
}
