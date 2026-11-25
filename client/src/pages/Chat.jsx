import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket, useSocketEvent } from '../context/SocketContext.jsx';
import Avatar from '../components/Avatar.jsx';
import Icon from '../components/Icon.jsx';
import MatchPanel, { talkingPoints } from '../components/MatchPanel.jsx';
import VerifiedBadge from '../components/VerifiedBadge.jsx';
import { clockTime } from '../utils.js';

function dayLabel(iso) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

const ICEBREAKERS = [
  'Hi! Which area are you hoping to live in?',
  "What's your ideal weekday evening at home?",
  'How do you usually split chores with roommates?',
];
const GROUP_GAP_MS = 5 * 60 * 1000;

/** Messages from the same person a few minutes apart are drawn as one group. */
function withGroups(messages) {
  return messages.map((m, i) => {
    const prev = messages[i - 1];
    const next = messages[i + 1];
    const sameDay = (a, b) => new Date(a.createdAt).toDateString() === new Date(b.createdAt).toDateString();
    const joins = (a, b) => a && b && a.senderId === b.senderId && sameDay(a, b)
      && Math.abs(new Date(b.createdAt) - new Date(a.createdAt)) < GROUP_GAP_MS;
    return { ...m, newDay: !prev || !sameDay(prev, m), first: !joins(prev, m), last: !joins(m, next) };
  });
}

/** One conversation: header, messages, suggestions and composer, plus the match panel beside it. */
export default function Chat({ id, onSeen }) {
  const { user } = useAuth();
  const socket = useSocket();
  const navigate = useNavigate();
  const [info, setInfo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [typing, setTyping] = useState(false);
  const [menu, setMenu] = useState(false);
  const [ideas, setIdeas] = useState(false);
  const [panel, setPanel] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const firstScroll = useRef(true);
  const typingTimer = useRef(null);
  const lastTypingSent = useRef(0);

  useEffect(() => {
    let cancelled = false;
    setInfo(null); setMessages([]); setError(''); setMenu(false); setIdeas(false); setPanel(false); setTyping(false);
    firstScroll.current = true;
    Promise.all([api(`/matches/${id}`), api(`/matches/${id}/messages`)])
      .then(([m, msgs]) => { if (!cancelled) { setInfo(m); setMessages(msgs.messages); } })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [id]);

  // Keep the newest message in view (jump on open, glide afterwards).
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: firstScroll.current ? 'auto' : 'smooth' });
    if (messages.length) firstScroll.current = false;
  }, [messages, typing, info]);

  const newest = messages[messages.length - 1]?.createdAt;
  useEffect(() => { if (newest) onSeen?.(id, newest); }, [id, newest, onSeen]);
  useEffect(() => () => clearTimeout(typingTimer.current), []);

  // Grow the message box with its text, up to about five lines.
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [text, info]);

  const addMessage = (m) => setMessages((list) => (list.some((x) => x.id === m.id) ? list : [...list, m]));

  useSocketEvent('message:new', (m) => {
    if (m.matchId !== id) return;
    addMessage(m);
    if (m.senderId !== user.id) setTyping(false);
  });
  useSocketEvent('typing', (t) => {
    if (t.matchId !== id) return;
    setTyping(true);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => setTyping(false), 2500);
  });
  useSocketEvent('match:removed', (r) => { if (r.matchId === id) navigate('/matches'); });

  function onType(e) {
    setText(e.target.value);
    const now = Date.now();
    if (socket && now - lastTypingSent.current > 1500) {
      socket.emit('typing', { matchId: id });
      lastTypingSent.current = now;
    }
  }

  async function send(body) {
    const msg = (body ?? text).trim();
    if (!msg) return;
    if (body === undefined) setText('');
    setIdeas(false);
    setError('');
    try {
      const r = await api(`/matches/${id}/messages`, { method: 'POST', body: { body: msg } });
      addMessage(r.message);
    } catch (err) {
      setError(err.message);
      if (body === undefined) setText(msg);
    }
  }

  // Suggestions go into the box rather than being sent, so people can make them their own.
  function fillPrompt(prompt) {
    setText(prompt);
    setIdeas(false);
    setPanel(false);
    requestAnimationFrame(() => { inputRef.current?.focus(); inputRef.current?.setSelectionRange(prompt.length, prompt.length); });
  }

  async function unmatch() {
    setMenu(false);
    if (!window.confirm(`Unmatch ${info.user.name}? Your chat will be deleted.`)) return;
    await api(`/matches/${id}`, { method: 'DELETE' });
    navigate('/matches');
  }

  async function block() {
    setMenu(false);
    if (!window.confirm(`Block ${info.user.name}? You won't see each other again.`)) return;
    await api('/blocks', { method: 'POST', body: { userId: info.user.id } });
    navigate('/matches');
  }

  if (!info) {
    return (
      <section className="chat-pane card">
        <div className="center-pad">{error ? <p className="error-box">{error}</p> : <div className="spinner" />}</div>
      </section>
    );
  }

  const first = info.user.name.split(' ')[0];
  const suggestions = [...talkingPoints(info.compatibility).map((p) => p.prompt), ...ICEBREAKERS];
  const grouped = withGroups(messages);

  return (
    <>
      <section className="chat-pane card" aria-label={`Chat with ${first}`}>
        <header className="chat-head">
          <Link to="/matches" className="back icon-btn" aria-label="Back to matches"><Icon name="back" /></Link>
          <Link to={`/users/${info.user.id}`} className="chat-who">
            <Avatar name={info.user.name} photo={info.user.photos?.[0]?.url} size={42} />
            <div>
              <b className="ellipsis">{info.user.name} <VerifiedBadge verified={info.user.verified} compact /></b>
              {typing
                ? <span className="small typing-text">typing…</span>
                : <span className="muted small ellipsis">{info.compatibility.score}% match{info.user.occupation ? ` · ${info.user.occupation}` : ''}</span>}
            </div>
          </Link>
          <Link to={`/agreement/${id}`} className="tool-chip accent chat-agree"><Icon name="doc" size={16} /><span>Agreement</span></Link>
          <button type="button" className={`icon-btn panel-toggle${panel ? ' on' : ''}`} onClick={() => setPanel(!panel)} aria-expanded={panel} aria-label={`About ${first}`} title={`About ${first}`}>
            <Icon name="info" />
          </button>
          <div className="menu-wrap">
            <button type="button" className="icon-btn" onClick={() => setMenu(!menu)} aria-haspopup="menu" aria-expanded={menu} aria-label="More options">
              <Icon name="more" />
            </button>
            {menu && (
              <div className="menu" role="menu">
                <Link role="menuitem" to={`/users/${info.user.id}`}><Icon name="sparkle" size={18} />View comparison</Link>
                <Link role="menuitem" to={`/agreement/${id}`}><Icon name="doc" size={18} />Roommate agreement</Link>
                <button type="button" role="menuitem" onClick={unmatch}><Icon name="x" size={18} />Unmatch</button>
                <button type="button" role="menuitem" className="danger" onClick={block}><Icon name="ban" size={18} />Block</button>
              </div>
            )}
          </div>
        </header>

        <div className="messages" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="chat-empty fade-up">
              <span className="avatar-ring"><Avatar name={info.user.name} photo={info.user.photos?.[0]?.url} size={84} /></span>
              <h3>You and {first} both said yes</h3>
              <p className="muted small">{info.compatibility.score}% match. Start with something real about living together:</p>
              <div className="chat-empty-list">
                {suggestions.slice(0, 4).map((q) => (
                  <button type="button" key={q} className="suggestion" onClick={() => fillPrompt(q)}>
                    <Icon name="chat" size={16} /><span>{q}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="match-note"><Icon name="home" size={14} />You matched with {first}. Be kind, and keep money talk for after you've met.</div>
          )}
          {grouped.map((m) => (
            <Fragment key={m.id}>
              {m.newDay && <span className="day-sep">{dayLabel(m.createdAt)}</span>}
              <div className={`bubble ${m.senderId === user.id ? 'mine' : 'theirs'}${m.first ? ' g-first' : ''}${m.last ? ' g-last' : ''}`}>
                <p>{m.body}</p>
                {m.last && <time dateTime={m.createdAt}>{clockTime(m.createdAt)}</time>}
              </div>
            </Fragment>
          ))}
          {typing && <div className="bubble theirs g-first g-last typing" aria-label={`${first} is typing`}><span /><span /><span /></div>}
        </div>

        {error && <p className="error-box chat-error">{error}</p>}

        {ideas && (
          <div className="idea-row" aria-label="Message ideas">
            {suggestions.map((q) => <button type="button" key={q} className="suggestion" onClick={() => fillPrompt(q)}><span>{q}</span></button>)}
          </div>
        )}

        <form className="composer" onSubmit={(e) => { e.preventDefault(); send(); }}>
          <button type="button" className={`icon-btn idea-btn${ideas ? ' on' : ''}`} onClick={() => setIdeas(!ideas)} aria-expanded={ideas} aria-label="Message ideas" title="Message ideas">
            <Icon name="bulb" />
          </button>
          <textarea
            ref={inputRef} rows={1} value={text} onChange={onType} maxLength={2000} aria-label="Message"
            placeholder={`Message ${first}…`}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }}
          />
          <button className="btn btn-primary send-btn" disabled={!text.trim()} aria-label="Send"><Icon name="send" size={20} /></button>
        </form>
      </section>

      <div className={`panel-slot${panel ? ' open' : ''}`}>
        {panel && <button type="button" className="panel-scrim" aria-label="Close details" onClick={() => setPanel(false)} />}
        <MatchPanel id={id} user={info.user} compatibility={info.compatibility} onPrompt={fillPrompt} onClose={() => setPanel(false)} />
      </div>
    </>
  );
}
