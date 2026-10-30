import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { EventProvider } from './context/EventContext.jsx';
import Landing from './pages/Landing.jsx';
import PartnerPage from './pages/PartnerPage.jsx';
import AdminLogin from './pages/admin/AdminLogin.jsx';
import Dashboard from './pages/admin/Dashboard.jsx';
import GuestRegister from './pages/wedding/GuestRegister.jsx';
import GuestGallery from './pages/wedding/GuestGallery.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <EventProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/partner" element={<PartnerPage />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<Dashboard />} />
          <Route path="/w/:slug/register" element={<GuestRegister />} />
          <Route path="/w/:slug" element={<GuestGallery />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </EventProvider>
    </BrowserRouter>
  );
}
