import { useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import { SocketProvider } from './context/SocketContext.jsx';
import Layout from './components/Layout.jsx';
import Welcome from './pages/Welcome.jsx';
import Landing from './pages/Landing.jsx';
import Onboarding from './pages/Onboarding.jsx';
import Discover from './pages/Discover.jsx';
import Matches from './pages/Matches.jsx';
import Profile from './pages/Profile.jsx';
import UserProfile from './pages/UserProfile.jsx';
import Agreement from './pages/Agreement.jsx';

// The "hello" animation plays once per visit (per browser tab session) for logged-out visitors.
// sessionStorage resets when the tab is closed, so every new visit sees it again.
const WELCOME_KEY = 'roomie_welcomed';
const seenWelcome = () => { try { return sessionStorage.getItem(WELCOME_KEY) === '1'; } catch { return true; } };

export default function App() {
  const { user, loading, error } = useAuth();
  const [welcomed, setWelcomed] = useState(seenWelcome);
  const [startAuth, setStartAuth] = useState(null); // 'register' | 'login' | null, chosen on the welcome steps

  if (loading) return <div className="center-screen"><div className="spinner" /></div>;
  if (error) return <div className="center-screen"><p className="error-box">{error}</p></div>;

  if (!user) {
    if (!welcomed) {
      return (
        <Welcome onDone={(mode) => {
          try { sessionStorage.setItem(WELCOME_KEY, '1'); } catch { /* ignore */ }
          setStartAuth(mode);
          setWelcomed(true);
        }} />
      );
    }
    return (
      <Routes>
        <Route path="*" element={<Landing initialAuth={startAuth} onReplayWelcome={() => { setStartAuth(null); setWelcomed(false); }} />} />
      </Routes>
    );
  }
  if (!user.onboarded) return <Routes><Route path="*" element={<Onboarding mode="setup" />} /></Routes>;

  return (
    <SocketProvider>
      <Layout>
        <Routes>
          <Route path="/discover" element={<Discover />} />
          <Route path="/matches" element={<Matches />} />
          <Route path="/chat/:matchId" element={<Matches />} />
          <Route path="/agreement/:matchId" element={<Agreement />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/profile/edit" element={<Onboarding mode="edit" />} />
          <Route path="/users/:id" element={<UserProfile />} />
          <Route path="*" element={<Navigate to="/discover" replace />} />
        </Routes>
      </Layout>
    </SocketProvider>
  );
}
