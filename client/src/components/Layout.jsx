import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocketEvent } from '../context/SocketContext.jsx';
import Avatar from './Avatar.jsx';
import Icon from './Icon.jsx';

const NAV = [
  { to: '/discover', label: 'Discover', icon: 'discover' },
  { to: '/matches', label: 'Matches', icon: 'chat' },
  { to: '/profile', label: 'Profile', icon: 'user' },
];

export default function Layout({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (/^\/(matches|chat)/.test(location.pathname)) setUnread(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  useSocketEvent('message:new', (m) => {
    if (m.senderId === user.id) return;
    if (location.pathname !== `/chat/${m.matchId}`) setUnread(true);
  });
  useSocketEvent('match:new', (m) => {
    setUnread(true);
    setToast({ text: `New roommate match: ${m.user.name.split(' ')[0]}`, to: `/chat/${m.matchId}` });
  });

  return (
    <div className="app-shell">
      <header className="topbar">
        <NavLink to="/discover" className="brand">
          <span className="brand-mark"><Icon name="home" size={20} /></span>
          <span className="grad-text">Roomie</span>
        </NavLink>
        <nav className="nav" aria-label="Main">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              <Icon name={n.icon} size={19} />
              <span className="nav-label">{n.label}</span>
              {n.to === '/matches' && unread && <span className="dot" aria-label="new activity" />}
            </NavLink>
          ))}
        </nav>
        <Link to="/profile" className="topbar-user" aria-label="Your profile">
          <span className="avatar-ring"><Avatar name={user.name} photo={user.photos?.[0]?.url} size={34} /></span>
        </Link>
      </header>
      <main className="main">{children}</main>
      {toast && (
        <button type="button" className="toast" onClick={() => { navigate(toast.to); setToast(null); }}>
          {toast.text} <span className="toast-cta">Say hi</span>
        </button>
      )}
    </div>
  );
}
