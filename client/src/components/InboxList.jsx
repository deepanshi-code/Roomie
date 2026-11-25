import { useState } from 'react';
import { Link } from 'react-router-dom';
import Avatar from './Avatar.jsx';
import Icon from './Icon.jsx';
import { isUnread } from '../seen.js';
import { scoreTone, timeAgo } from '../utils.js';

/** Left column of the inbox: search, new matches (no messages yet), then conversations. */
export default function InboxList({ matches, userId, seen, activeId }) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const shown = q ? matches.filter((m) => m.user.name.toLowerCase().includes(q)) : matches;
  const fresh = shown.filter((m) => !m.lastMessage);
  const convos = shown.filter((m) => m.lastMessage);
  const unreadCount = matches.filter((m) => isUnread(m, userId, seen)).length;

  return (
    <aside className="inbox-list card" aria-label="Your matches">
      <div className="il-head">
        <div>
          <h1>Matches</h1>
          <p className="muted small">
            {matches.length} {matches.length === 1 ? 'person' : 'people'}
            {unreadCount > 0 && <> · <b className="il-unread-count">{unreadCount} unread</b></>}
          </p>
        </div>
        <Link to="/discover" className="icon-btn" aria-label="Find more people" title="Find more people"><Icon name="discover" /></Link>
      </div>

      {matches.length > 3 && (
        <label className="il-search">
          <Icon name="filter" size={16} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name" aria-label="Search matches by name" />
        </label>
      )}

      {fresh.length > 0 && (
        <section className="il-section">
          <h3 className="il-label">New matches <span className="muted">· say hi</span></h3>
          <div className="fresh-row">
            {fresh.map((m) => (
              <Link key={m.id} to={`/chat/${m.id}`} className={`fresh-item${m.id === activeId ? ' active' : ''}`}>
                <span className="avatar-ring"><Avatar name={m.user.name} photo={m.user.photos?.[0]?.url} size={56} /></span>
                <span className="fresh-name">{m.user.name.split(' ')[0]}</span>
                <span className={`fresh-score tone-${scoreTone(m.score)}`}>{m.score}%</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {convos.length > 0 && (
        <section className="il-section il-grow">
          <h3 className="il-label">Messages</h3>
          <ul className="convo-list">
            {convos.map((m) => {
              const unread = isUnread(m, userId, seen);
              const mine = m.lastMessage.senderId === userId;
              return (
                <li key={m.id}>
                  <Link to={`/chat/${m.id}`} className={`convo${m.id === activeId ? ' active' : ''}${unread ? ' unread' : ''}`} aria-current={m.id === activeId ? 'page' : undefined}>
                    <Avatar name={m.user.name} photo={m.user.photos?.[0]?.url} size={46} />
                    <div className="convo-body">
                      <div className="convo-top">
                        <b className="ellipsis">{m.user.name}</b>
                        <span className="convo-time">{timeAgo(m.lastMessage.createdAt)}</span>
                      </div>
                      <div className="convo-bottom">
                        <p className="ellipsis">{mine && <span className="muted">You: </span>}{m.lastMessage.body}</p>
                        {unread
                          ? <span className="unread-dot" aria-label="Unread" />
                          : <span className={`convo-score tone-${scoreTone(m.score)}`}>{m.score}%</span>}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {q && shown.length === 0 && <p className="muted small il-none">Nobody called "{query}" in your matches.</p>}
    </aside>
  );
}
