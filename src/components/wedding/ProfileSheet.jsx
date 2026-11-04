import { useEffect, useState } from 'react';
import Modal from '../ui/Modal.jsx';
import Avatar from '../feed/Avatar.jsx';
import { isPasscodeValid, signOutGuest, updateGuestPasscode } from '../../lib/guestProfile.js';

/** A single-tap "show/hide" control for the passcode fields. */
function EyeButton({ shown, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={shown}
      aria-label={shown ? 'Hide passcode' : 'Show passcode'}
      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full border border-brown/20 bg-white px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-brown/60 transition hover:border-gold hover:text-brown"
    >
      {shown ? 'Hide' : 'Show'}
    </button>
  );
}

function Status({ error, saved }) {
  if (error) {
    return <p className="rounded-xl bg-rose/10 px-3 py-2 text-[12px] leading-snug text-rose-dark">{error}</p>;
  }
  if (saved) {
    return <p className="rounded-xl bg-gold/15 px-3 py-2 text-[12px] leading-snug text-brown">Saved.</p>;
  }
  return null;
}

/**
 * Profile & account settings for a checked-in guest.
 *
 * Everything here is scoped to the device session token: the passcode is
 * re-hashed by the server, and signing out only ends this session — photos,
 * notes and reactions stay in the gallery. The display name is fixed at
 * check-in and is shown here, not edited.
 */
export default function ProfileSheet({ open, onClose, session, coupleNames, onSignedOut }) {
  const [currentPin, setCurrentPin] = useState('');
  const [nextPin, setNextPin] = useState('');
  const [showPins, setShowPins] = useState(false);
  const [pinSaving, setPinSaving] = useState(false);
  const [pinError, setPinError] = useState(null);
  const [pinSaved, setPinSaved] = useState(false);

  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // Reset only when the sheet opens. Depending on the name here would wipe the
  // "Saved." confirmation the moment a rename propagated down as a new prop.
  useEffect(() => {
    if (!open) return;
    setCurrentPin('');
    setNextPin('');
    setShowPins(false);
    setPinError(null);
    setPinSaved(false);
    setConfirmSignOut(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const savePasscode = async (event) => {
    event.preventDefault();
    if (pinSaving) return;
    setPinError(null);
    setPinSaved(false);

    if (!isPasscodeValid(nextPin)) {
      setPinError('Passcodes are 4 to 12 letters or digits, with no spaces.');
      return;
    }

    setPinSaving(true);
    try {
      await updateGuestPasscode({ token: session?.token, current: currentPin, next: nextPin });
      setCurrentPin('');
      setNextPin('');
      setShowPins(false);
      setPinSaved(true);
    } catch (err) {
      setPinError(err.message || 'Your passcode could not be changed.');
    } finally {
      setPinSaving(false);
    }
  };

  const signOut = async () => {
    setSigningOut(true);
    try {
      await signOutGuest({ token: session?.token });
    } finally {
      setSigningOut(false);
      onSignedOut?.();
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Your profile">
      <div className="space-y-5">
        {/* Who is checked in */}
        <div className="flex items-center gap-3 rounded-2xl border border-brown/10 bg-white/70 p-3.5">
          <Avatar name={session?.fullName || 'Guest'} size="lg" ring />
          <div className="min-w-0">
            <p className="truncate font-display text-[17px] font-semibold leading-tight text-brown-dark">
              {session?.fullName || 'Guest'}
            </p>
            <p className="truncate text-[11px] text-brown/50">
              {coupleNames ? `Checked in to ${coupleNames}` : 'Checked in to this gallery'}
            </p>
          </div>
        </div>

        <div className="h-px bg-brown/10" />

        {/* Passcode */}
        <form onSubmit={savePasscode} className="space-y-2.5">
          <div>
            <p className="oge-label">Passcode</p>
            <p className="mb-2 text-[11px] leading-snug text-brown/45">
              Your passcode is stored scrambled, so it cannot be shown — but you can replace it here.
              Keep 4 to 12 letters or digits, no spaces.
            </p>

            <div className="relative">
              <input
                className="oge-input pr-16"
                type={showPins ? 'text' : 'password'}
                value={currentPin}
                onChange={(event) => {
                  setCurrentPin(event.target.value);
                  setPinSaved(false);
                  setPinError(null);
                }}
                placeholder="Current passcode"
                inputMode="text"
                autoComplete="current-password"
                maxLength={12}
                aria-label="Current passcode"
                disabled={pinSaving}
              />
              <EyeButton shown={showPins} onToggle={() => setShowPins((v) => !v)} />
            </div>

            <div className="relative mt-2">
              <input
                className="oge-input pr-16"
                type={showPins ? 'text' : 'password'}
                value={nextPin}
                onChange={(event) => {
                  setNextPin(event.target.value);
                  setPinSaved(false);
                  setPinError(null);
                }}
                placeholder="New passcode"
                autoComplete="new-password"
                maxLength={12}
                aria-label="New passcode"
                disabled={pinSaving}
              />
              <EyeButton shown={showPins} onToggle={() => setShowPins((v) => !v)} />
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <Status error={pinError} saved={pinSaved} />
            <button
              type="submit"
              className="oge-btn-outline ml-auto shrink-0 px-4 py-2 text-xs"
              disabled={pinSaving || !currentPin.trim() || !nextPin.trim()}
            >
              {pinSaving ? 'Updating…' : 'Update passcode'}
            </button>
          </div>
        </form>

        <div className="h-px bg-brown/10" />

        {/* Account */}
        <div className="space-y-2">
          <p className="oge-label">Account</p>
          {!confirmSignOut ? (
            <>
              <button
                type="button"
                onClick={() => setConfirmSignOut(true)}
                className="oge-btn-outline w-full py-2.5 text-sm"
              >
                Switch account / log out
              </button>
              <p className="text-[11px] leading-snug text-brown/45">
                You will be taken back to the event entry screen. Everything you shared stays in the
                gallery, and checking back in with your name and passcode restores it.
              </p>
            </>
          ) : (
            <div className="rounded-2xl border border-rose/30 bg-rose/5 p-3">
              <p className="text-[13px] font-semibold text-brown-dark">Log out on this device?</p>
              <p className="mt-1 text-[11px] leading-snug text-brown/60">
                Your photos, notes and reactions stay with your guest name.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={signOut}
                  disabled={signingOut}
                  className="oge-btn-primary flex-1 py-2 text-xs"
                >
                  {signingOut ? 'Logging out…' : 'Log out'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmSignOut(false)}
                  disabled={signingOut}
                  className="oge-btn-outline flex-1 py-2 text-xs"
                >
                  Stay
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
