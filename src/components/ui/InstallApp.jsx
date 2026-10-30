import { useEffect, useState } from 'react';
import {
  clearInstallPrompt,
  getInstallPrompt,
  subscribeInstallPrompt,
} from '../../lib/install.js';

const DISMISS_KEY = 'oge_install_dismissed';

function isStandalone() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.matchMedia?.('(display-mode: fullscreen)').matches ||
    window.navigator.standalone === true
  );
}

function isIos() {
  const ua = navigator.userAgent || '';
  return /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function wasDismissed() {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * In-app install control. Chrome/Edge/Android fire `beforeinstallprompt`,
 * which we hold until the guest taps Install (the prompt may only be shown
 * from a user gesture). iOS Safari has no such event, so we show the
 * Share → Add to Home Screen instructions instead.
 */
export default function InstallApp({ raised = false }) {
  const [canPrompt, setCanPrompt] = useState(() => Boolean(getInstallPrompt()));
  const [installed, setInstalled] = useState(() => (typeof window === 'undefined' ? true : isStandalone()));
  const [dismissed, setDismissed] = useState(() => (typeof window === 'undefined' ? true : wasDismissed()));
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    const sync = () => setCanPrompt(Boolean(getInstallPrompt()));
    const unsubscribe = subscribeInstallPrompt(sync);

    const onInstalled = () => setInstalled(true);
    const onDisplayChange = (event) => {
      if (event.matches) setInstalled(true);
    };
    window.addEventListener('appinstalled', onInstalled);
    const media = window.matchMedia('(display-mode: standalone)');
    media.addEventListener?.('change', onDisplayChange);

    return () => {
      unsubscribe();
      window.removeEventListener('appinstalled', onInstalled);
      media.removeEventListener?.('change', onDisplayChange);
    };
  }, []);

  const dismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* storage unavailable — just hide for this page */
    }
  };

  const install = async () => {
    const event = getInstallPrompt();
    if (!event) {
      setShowIosHelp(true);
      return;
    }
    event.prompt();
    const choice = await event.userChoice;
    clearInstallPrompt();
    setCanPrompt(false);
    if (choice?.outcome === 'accepted') setInstalled(true);
  };

  const ios = isIos();
  if (installed || dismissed) return null;
  if (!canPrompt && !ios) return null;

  const helping = showIosHelp || (ios && !canPrompt);

  return (
    <div
      className={`pointer-events-none fixed inset-x-0 z-40 px-3 ${
        raised
          ? 'bottom-[calc(var(--oge-nav-h)+env(safe-area-inset-bottom))] pb-2'
          : 'bottom-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]'
      }`}
    >
      <div className="pointer-events-auto mx-auto flex max-w-sm items-center gap-3 rounded-2xl border border-brown/15 bg-cream/95 p-3 shadow-soft backdrop-blur">
        <img src="/icons/icon-192.png" alt="" width="40" height="40" className="h-10 w-10 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1 text-left">
          <p className="font-display text-sm font-semibold leading-snug text-brown">Keep the gallery one tap away</p>
          {helping ? (
            <p className="mt-0.5 text-xs leading-snug text-brown/65">
              {ios
                ? 'Tap the Share button, then “Add to Home Screen”.'
                : 'Open your browser menu and choose “Install app”.'}
            </p>
          ) : (
            <p className="mt-0.5 text-xs leading-snug text-brown/65">Add it to your home screen — no app store.</p>
          )}
        </div>
        {!helping && (
          <button type="button" onClick={install} className="oge-btn-primary shrink-0 px-4 py-2 text-xs">
            Install
          </button>
        )}
        <button
          type="button"
          onClick={dismiss}
          aria-label="Not now"
          className="shrink-0 rounded-full px-2 text-lg leading-none text-brown/40 hover:text-brown"
        >
          ×
        </button>
      </div>
    </div>
  );
}
