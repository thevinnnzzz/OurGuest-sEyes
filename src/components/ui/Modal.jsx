import { useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function Modal({ open, onClose, title, children, size = 'md', footer = null }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  const sizes = { md: 'max-w-md', lg: 'max-w-2xl', xl: 'max-w-4xl' };

  const header = (
    <div className="flex items-start justify-between gap-4">
      <h2 className="font-display text-xl font-semibold text-brown">{title}</h2>
      <button
        type="button"
        onClick={onClose}
        className="rounded-full border border-brown/20 px-3 py-1 text-lg leading-none text-brown/70 hover:bg-beige"
        aria-label="Close dialog"
      >
        ×
      </button>
    </div>
  );

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <div className="oge-backdrop-in absolute inset-0 bg-brown-dark/50 backdrop-blur-sm" onClick={onClose} />
      {footer ? (
        // With a footer the dialog becomes a flex column: the header and the
        // footer stay put and only the body scrolls, so a pinned composer can
        // never cover the content above it.
        <div
          className={`oge-sheet-in relative z-10 flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-cream shadow-2xl sm:max-h-[85dvh] sm:rounded-3xl ${sizes[size]}`}
        >
          <div className="flex-none px-5 pb-3 pt-5 sm:px-6 sm:pt-6">{header}</div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 sm:px-6">{children}</div>
          <div className="flex-none border-t border-brown/10 bg-cream px-5 pb-[calc(0.85rem+env(safe-area-inset-bottom))] pt-3 sm:px-6">
            {footer}
          </div>
        </div>
      ) : (
        <div
          className={`oge-sheet-in relative z-10 max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-cream p-6 shadow-2xl sm:rounded-3xl ${sizes[size]}`}
        >
          <div className="mb-4">{header}</div>
          {children}
        </div>
      )}
    </div>,
    document.body,
  );
}
