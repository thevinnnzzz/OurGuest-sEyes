import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { EventProvider } from './context/EventContext.jsx';
import Landing from './pages/Landing.jsx';
import PartnerPage from './pages/PartnerPage.jsx';
import AdminLogin from './pages/admin/AdminLogin.jsx';
import Dashboard from './pages/admin/Dashboard.jsx';
import GuestRegister from './pages/wedding/GuestRegister.jsx';
import GuestGallery from './pages/wedding/GuestGallery.jsx';
import HeartLoader from './components/ui/HeartLoader.jsx';
import { supabase, supabaseReady } from './lib/supabase.js';
import { readStoredSession } from './lib/guestSession.js';

// Paths that belong to the owner portal, the marketing site, or the bundled
// assets. They must never be mistaken for a wedding slug at the root.
const RESERVED_PATHS = new Set([
  'admin',
  'dashboard',
  'owner',
  'partner',
  'w',
  'api',
  'assets',
  'icons',
  'favicon.ico',
  'manifest.webmanifest',
  'sw.js',
]);

/** Admin/owner area: never reachable by a guest, even via a stale link. */
function AdminGuard({ children }) {
  const [state, setState] = useState(supabaseReady ? 'checking' : 'ready');

  useEffect(() => {
    if (!supabaseReady) return undefined;
    let alive = true;
    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (alive) setState(data?.user ? 'ready' : 'signed-out');
      })
      .catch(() => {
        if (alive) setState('signed-out');
      });
    return () => {
      alive = false;
    };
  }, []);

  if (state === 'checking') return <HeartLoader label="Unlocking the dashboard…" />;
  if (state === 'signed-out') return <Navigate to="/admin/login" replace />;
  return children;
}

/**
 * Root-level guest alias: ourguestseyes.netlify.app/sarah-john-wedding.
 * Normalises onto the canonical /w/:slug so every QR code, share link and
 * session comparison uses one URL shape.
 */
function GuestAlias() {
  const { eventId } = useParams();
  if (!eventId) return <Navigate to="/" replace />;
  if (RESERVED_PATHS.has(eventId.toLowerCase())) return <Navigate to="/" replace />;
  return <Navigate to={`/w/${encodeURIComponent(eventId)}`} replace />;
}

/**
 * An installed app opens `start_url` (/?launch=pwa). If this device still has a
 * guest session, carry it straight into that wedding instead of the marketing
 * page — the behaviour guests expect from an "Add to Home Screen" icon.
 */
function LaunchRedirect() {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();

  useEffect(() => {
    if (pathname !== '/') return undefined;
    if (!new URLSearchParams(search).has('launch')) return undefined;
    let alive = true;
    readStoredSession().then((stored) => {
      if (alive && stored?.slug) {
        navigate(`/w/${encodeURIComponent(stored.slug)}`, { replace: true });
      }
    });
    return () => {
      alive = false;
    };
  }, [pathname, search, navigate]);

  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <EventProvider>
        <LaunchRedirect />
        <Routes>
          {/* Owner portal + marketing */}
          <Route path="/" element={<Landing />} />
          <Route path="/partner" element={<PartnerPage />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route
            path="/admin"
            element={(
              <AdminGuard>
                <Dashboard />
              </AdminGuard>
            )}
          />
          {/* Legacy owner paths land on the guarded dashboard, never on "/". */}
          <Route path="/dashboard" element={<Navigate to="/admin" replace />} />
          <Route path="/owner" element={<Navigate to="/admin" replace />} />

          {/* Guest experience */}
          <Route path="/w/:slug/register" element={<GuestRegister />} />
          <Route path="/w/:slug" element={<GuestGallery />} />
          <Route path="/:eventId" element={<GuestAlias />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </EventProvider>
    </BrowserRouter>
  );
}
