// Holds the browser's deferred install prompt for the lifetime of the page.
// It lives outside React so it survives client-side navigation (registration →
// gallery) and is not lost when the banner unmounts.

let deferredEvent = null;
const listeners = new Set();

function notify() {
  listeners.forEach((listener) => listener());
}

if (typeof window !== 'undefined') {
  // Chrome/Edge/Android only fire this once the app meets the installability
  // criteria (valid manifest, icons, service worker). Saving it lets our own
  // button trigger the install later, from a user gesture.
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredEvent = event;
    notify();
  });

  window.addEventListener('appinstalled', () => {
    deferredEvent = null;
    notify();
  });
}

export function getInstallPrompt() {
  return deferredEvent;
}

export function clearInstallPrompt() {
  deferredEvent = null;
  notify();
}

export function subscribeInstallPrompt(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
