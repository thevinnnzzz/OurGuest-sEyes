import { CardsIcon, GridIcon, NoteIcon } from './icons.jsx';

// Order is authoritative — Gallery is first and is the landing tab.
export const TABS = [
  { id: 'gallery', label: 'Gallery', Icon: CardsIcon },
  { id: 'photos', label: 'Photos', Icon: GridIcon },
  { id: 'notes', label: 'Notes', Icon: NoteIcon },
];

export const DEFAULT_TAB = TABS[0].id;

export default function BottomNav({ active, onChange }) {
  return (
    <nav
      aria-label="Gallery sections"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-brown/10 bg-cream/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <div className="mx-auto flex h-[var(--oge-nav-h)] max-w-[470px] items-stretch px-1">
        {TABS.map(({ id, label, Icon }) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              aria-current={isActive ? 'page' : undefined}
              aria-label={label}
              className={`flex min-h-[44px] flex-1 flex-col items-center justify-center gap-1 transition ${
                isActive ? 'text-brown-dark' : 'text-brown/45 hover:text-brown/70'
              }`}
            >
              <Icon
                className={`h-6 w-6 transition-transform duration-300 ease-out ${
                  isActive ? '[stroke-width:2.3] scale-110' : 'scale-100'
                }`}
              />
              <span className="text-[10px] font-medium tracking-wide">{label}</span>
              <span
                className={`h-1 w-1 rounded-full bg-brown-dark transition-all duration-300 ease-out ${
                  isActive ? 'scale-100 opacity-100' : 'scale-0 opacity-0'
                }`}
              />
            </button>
          );
        })}
      </div>
    </nav>
  );
}
