import { useEffect, useState } from 'react';
import {
  clearInstallPrompt,
  getInstallPrompt,
  subscribeInstallPrompt,
} from '../../lib/install.js';
import Modal from './Modal.jsx';

const DISMISS_KEY = 'oge_install_dismissed';
// Long enough that the guest reads the check-in card first instead of being
// interrupted mid-tap.
const OPEN_DELAY = 2200;

const BENEFITS = [
  ['One tap.', 'Your own icon on the home screen — no link to hunt for again.'],
  ['Full screen.', 'Photos and letters fill the display, with no address bar.'],
  ['Steady signal.', 'Pages you have already opened stay ready when the venue Wi-Fi drops.'],
];

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

function Tick() {
  return (
    <span
      aria-hidden="true"
      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gold/25 text-[11px] font-bold text-brown"
    >
      ✓
    </span>
  );
}

/**
 * Persuasive install card, shown as a modal on the first visit.
 *
 * Chrome/Edge/Android fire `beforeinstallprompt`, which we hold until the guest
 * taps Install (the prompt may only be shown from a user gesture). iOS Safari
 * has no such event, so the modal explains Share → Add to Home Screen instead.
 * Nothing is blocked: "Not now" dismisses it for good on this device.
 */
export default function InstallApp() {
  const [canPrompt, setCanPrompt] = useState(() => Boolean(getInstallPrompt()));
  const [installed, setInstalled] = useState(() => (typeof window === 'undefined' ? true : isStandalone()));
  const [dismissed, setDismissed] = useState(() => (typeof window === 'undefined' ? true : wasDismissed()));
  const [open, setOpen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [busy, setBusy] = useState(false);

  const ios = typeof navigator === 'undefined' ? false : isIos();
  const eligible = !installed && !dismissed && (canPrompt || ios);

  useEffect(() => {
    const sync = () => setCanPrompt(Boolean(getInstallPrompt()));
    const unsubscribe = subscribeInstallPrompt(sync);

    const onInstalled = () => {
      setInstalled(true);
      setOpen(false);
    };
    const onDisplayChange = (event) => {
      if (event.matches) onInstalled();
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

  // Open once per visit, a beat after the page settles. Showing it when the
  // browser prompt arrives late covers the case where the timer fired first.
  useEffect(() => {
    if (!eligible) return undefined;
    let timer;
    const typing = () => ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);
    const openSoon = (delay) => {
      timer = setTimeout(() => {
        // Never pop over the keyboard while a guest is entering their name.
        if (typing()) {
          openSoon(4000);
          return;
        }
        setOpen(true);
      }, delay);
    };
    openSoon(OPEN_DELAY);
    return () => clearTimeout(timer);
  }, [eligible]);

  const dismiss = () => {
    setDismissed(true);
    setOpen(false);
    try {
      window.localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* storage unavailable — just hide for this page */
    }
  };

  const install = async () => {
    const event = getInstallPrompt();
    if (!event) {
      setShowHelp(true);
      return;
    }
    setBusy(true);
    try {
      event.prompt();
      const choice = await event.userChoice;
      clearInstallPrompt();
      setCanPrompt(false);
      if (choice?.outcome === 'accepted') {
        setInstalled(true);
        setOpen(false);
      } else {
        dismiss();
      }
    } finally {
      setBusy(false);
    }
  };

  if (!eligible) return null;

  const helping = showHelp || !canPrompt;

  return (
    <Modal open={open} onClose={dismiss} title="Add the gallery to your home screen">
      <div className="text-center">
        <img
          src="/icons/icon-192.png"
          alt=""
          width="76"
          height="76"
          className="mx-auto h-[76px] w-[76px] rounded-2xl shadow-card"
        />
        <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-brown/70">
          Guests who add it open the gallery with one tap on the day — no link to find, no browser to
          dig through.
        </p>
      </div>

      {helping ? (
        <div className="mt-5 rounded-2xl border border-brown/10 bg-white/70 p-4 text-left">
          <p className="text-[10px] uppercase tracking-[0.2em] text-brown/45">
            {ios ? 'on iPhone / iPad' : 'in your browser'}
          </p>
          <ol className="mt-2 space-y-2 text-sm leading-relaxed text-brown/75">
            {ios ? (
              <>
                <li>
                  <span className="font-semibold text-brown">1.</span> Tap the Share button{' '}
                  <span aria-hidden="true">⤴︎</span> at the bottom of Safari.
                </li>
                <li>
                  <span className="font-semibold text-brown">2.</span> Scroll down and choose{' '}
                  <span className="font-semibold text-brown">Add to Home Screen</span>.
                </li>
                <li>
                  <span className="font-semibold text-brown">3.</span> Tap{' '}
                  <span className="font-semibold text-brown">Add</span> — the gallery lands on your home
                  screen.
                </li>
              </>
            ) : (
              <>
                <li>
                  <span className="font-semibold text-brown">1.</span> Open your browser menu (
                  <span aria-hidden="true">⋮</span> or <span aria-hidden="true">⋯</span>).
                </li>
                <li>
                  <span className="font-semibold text-brown">2.</span> Choose{' '}
                  <span className="font-semibold text-brown">Add to Home Screen</span> or{' '}
                  <span className="font-semibold text-brown">Install</span>.
                </li>
                <li>
                  <span className="font-semibold text-brown">3.</span> Confirm — the gallery appears with
                  your other apps.
                </li>
              </>
            )}
          </ol>
        </div>
      ) : (
        <ul className="mt-5 space-y-2.5 text-left">
          {BENEFITS.map(([title, detail]) => (
            <li key={title} className="flex items-start gap-2.5">
              <Tick />
              <p className="text-sm leading-snug text-brown/75">
                <span className="font-semibold text-brown">{title}</span> {detail}
              </p>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-4 text-center text-[11px] text-brown/45">
        Same site, no app store, no account — you can still use it in your browser.
      </p>

      <div className="mt-5">
        {helping ? (
          <button type="button" className="oge-btn-primary w-full py-3" onClick={dismiss}>
            Got it — I&apos;ll add it
          </button>
        ) : (
          <button type="button" className="oge-btn-primary w-full py-3" onClick={install} disabled={busy}>
            {busy ? 'Opening installer…' : 'Install the gallery'}
          </button>
        )}
      </div>
    </Modal>
  );
}
