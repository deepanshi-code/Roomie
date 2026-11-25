import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocketEvent } from '../context/SocketContext.jsx';
import Icon from '../components/Icon.jsx';
import InboxList from '../components/InboxList.jsx';
import { markSeen, readSeen } from '../seen.js';
import Chat from './Chat.jsx';

/**
 * The inbox, used for both /matches and /chat/:matchId.
 * Wide screens: list | chat | details side by side. Phones: the list and the chat are separate screens.
 */
export default function Matches() {
  const { matchId } = useParams();
  const activeId = matchId ? Number(matchId) : null;
  const { user } = useAuth();
  const [matches, setMatches] = useState(null);
  const [error, setError] = useState('');
  const [seen, setSeen] = useState(() => readSeen(user.id));

  const load = useCallback(() => {
    api('/matches').then((d) => setMatches(d.matches)).catch((e) => setError(e.message));
  }, []);
  useEffect(() => { load(); }, [load]);
  useSocketEvent('message:new', load);
  useSocketEvent('match:new', load);
  useSocketEvent('match:removed', load);

  const onSeen = useCallback((id, createdAt) => setSeen(markSeen(user.id, id, createdAt)), [user.id]);

  if (!matches) return <div className="center-pad">{error ? <p className="error-box">{error}</p> : <div className="spinner" />}</div>;

  if (matches.length === 0 && !activeId) {
    return (
      <div className="card empty fade-up">
        <span className="icon-badge big"><Icon name="users" size={30} /></span>
        <h2>No matches yet</h2>
        <p className="muted">When you and someone else both like each other, they show up here and you can chat.</p>
        <Link className="btn btn-primary" to="/discover">Start discovering</Link>
      </div>
    );
  }

  return (
    <div className={`inbox${activeId ? ' in-chat' : ''}`}>
      <InboxList matches={matches} userId={user.id} seen={seen} activeId={activeId} />
      {activeId ? (
        <Chat key={activeId} id={activeId} onSeen={onSeen} />
      ) : (
        <section className="chat-pane card inbox-placeholder">
          <span className="icon-badge big"><Icon name="chat" size={30} /></span>
          <h2>Pick a conversation</h2>
          <p className="muted">Choose someone on the left to chat. Each chat shows why you match, what to talk about first, and your roommate agreement.</p>
          <Link to="/discover" className="btn btn-ghost btn-sm">Find more people</Link>
        </section>
      )}
    </div>
  );
}
