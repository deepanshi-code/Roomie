import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import Icon from '../components/Icon.jsx';
import MatchModal from '../components/MatchModal.jsx';
import DiscoverCard from '../components/DiscoverCard.jsx';
import MatchDetails from '../components/MatchDetails.jsx';
import Tour from '../components/Tour.jsx';

const SWIPE_THRESHOLD = 110; // px of horizontal drag that counts as a decision
const FLY_MS = 300;

const TOP_CARD = '.dv-card';
/** Guided tour of the Discover screen: what each part is, and why you'd tap it. */
const TOUR_STEPS = [
  { target: TOP_CARD, title: 'This is a possible roommate', text: 'Each card is one person near you, with their photo (or initials), age, job and area. Best matches come first.' },
  { target: `${TOP_CARD} .score-pill`, title: 'Your match score', text: 'How well your daily habits fit, from 0 to 100%. It looks at both sides: what you care about and what they care about.' },
  { target: '.dv-details', title: "Why you'd match", text: "Budget, move-in date, why you'd get along and what to talk about first. Everything you need to decide, right next to the card." },
  { target: '.btn-round.like', title: 'Like: you could live with them', text: "Tap the thumbs-up or swipe the card right. If they say yes too, you match and can chat." },
  { target: '.btn-round.pass', title: 'Pass: not the right fit', text: "Tap the cross or swipe left. They won't be told, and you'll move on to the next person." },
  { target: '.btn-round.info', title: 'See the full comparison', text: 'Every answer side by side, so you can see exactly where you match and where you differ before deciding.' },
  { target: '.discover-head .toggle', title: 'Only verified people', text: 'Turn this on to only see people who verified a college or work email.' },
  { target: '.nav a[href="/matches"]', title: 'Your matches and chats', text: 'Everyone who liked you back shows up here. Open a chat to talk and to agree on house rules.' },
  { target: '.nav a[href="/profile"]', title: 'Your profile', text: 'Add photos, get your verified badge, edit your answers or change the app theme.' },
];
const tourKey = (id) => `roomie_tour_done_${id}`;

export default function Discover() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [match, setMatch] = useState(null);
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false });
  const [leaving, setLeaving] = useState(null); // 'like' | 'pass' while the card flies away
  const [verifiedOnly, setVerifiedOnly] = useState(() => {
    try { return localStorage.getItem('roomie_verified_only') === '1'; } catch { return false; }
  });
  const startRef = useRef(null);
  const movedRef = useRef(false);
  const location = useLocation();
  const [showTour, setShowTour] = useState(false);

  function toggleVerified(e) {
    setVerifiedOnly(e.target.checked);
    try { localStorage.setItem('roomie_verified_only', e.target.checked ? '1' : '0'); } catch { /* ignore */ }
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api(`/discover${verifiedOnly ? '?verifiedOnly=1' : ''}`);
      setItems(d.results);
      setTotal(d.total);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [verifiedOnly]);

  useEffect(() => { load(); }, [load]);

  const current = items[0];

  useEffect(() => {
    if (loading || !current || showTour) return;
    let done = false;
    try { done = localStorage.getItem(tourKey(user.id)) === '1'; } catch { /* ignore */ }
    if (location.state?.tour || !done) {
      const t = setTimeout(() => setShowTour(true), 500); // let the card finish appearing first
      return () => clearTimeout(t);
    }
  }, [loading, current, location.state, user.id, showTour]);

  const closeTour = useCallback(() => {
    try { localStorage.setItem(tourKey(user.id), '1'); } catch { /* ignore */ }
    setShowTour(false);
    if (location.state?.tour) navigate('/discover', { replace: true, state: null });
  }, [user.id, location.state, navigate]);

  /** Animate the top card off screen, then record the decision. */
  const decide = useCallback(async (action) => {
    if (!current || leaving || match || showTour) return;
    setLeaving(action);
    setDrag({ x: (action === 'like' ? 1 : -1) * window.innerWidth * 1.2, y: 40, active: false });
    await new Promise((r) => setTimeout(r, FLY_MS));
    try {
      const r = await api('/swipes', { method: 'POST', body: { toId: current.user.id, action } });
      if (r.matched) setMatch({ user: current.user, matchId: r.matchId, score: current.compatibility.score });
      setTotal((t) => t - 1);
      setItems((list) => list.slice(1));
    } catch (err) {
      setError(err.message);
    } finally {
      setDrag({ x: 0, y: 0, active: false });
      setLeaving(null);
    }
  }, [current, leaving, match, showTour]);

  // Drag-to-swipe. Listeners go on window so a fast swipe that leaves the card still works.
  function onPointerDown(e) {
    if (leaving || match || showTour || e.button > 0 || e.target.closest('.pc-body, .score-pill')) return;
    startRef.current = { x: e.clientX, y: e.clientY };
    movedRef.current = false;

    const move = (ev) => {
      const dx = ev.clientX - startRef.current.x;
      const dy = ev.clientY - startRef.current.y;
      if (Math.abs(dx) > 6) movedRef.current = true;
      setDrag({ x: dx, y: dy * 0.25, active: true });
    };
    const up = (ev) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      const dx = ev.clientX - startRef.current.x;
      startRef.current = null;
      if (Math.abs(dx) > SWIPE_THRESHOLD) decide(dx > 0 ? 'like' : 'pass');
      else setDrag({ x: 0, y: 0, active: false });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  // A drag shouldn't also count as a tap on the photo (which switches photos).
  function onClickCapture(e) {
    if (movedRef.current) { e.stopPropagation(); e.preventDefault(); movedRef.current = false; }
  }

  // Refill when the visible batch runs out but more candidates exist.
  useEffect(() => {
    if (!loading && items.length === 0 && total > 0) load();
  }, [items.length, total, loading, load]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest('input, textarea, select')) return;
      if (e.key === 'ArrowLeft') decide('pass');
      if (e.key === 'ArrowRight') decide('like');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [decide]);

  if (loading && items.length === 0) return <div className="center-pad"><div className="spinner" /></div>;

  const likeOpacity = Math.min(Math.max(drag.x / 100, 0), 1);
  const nopeOpacity = Math.min(Math.max(-drag.x / 100, 0), 1);
  const next = items[1];

  return (
    <div className="discover">
      <div className="discover-head">
        <div>
          <h1>Discover</h1>
          <p className="muted small" style={{ margin: 0 }}>
            {total > 0
              ? `${total} ${verifiedOnly ? 'verified ' : ''}${total === 1 ? 'person' : 'people'} in ${user.city} · best match first`
              : `People in ${user.city}`}
          </p>
        </div>
        <label className="toggle">
          <input type="checkbox" checked={verifiedOnly} onChange={toggleVerified} />
          <span>Verified only</span>
        </label>
      </div>

      {(!user.photos?.length || !user.verified) && (
        <Link to={!user.photos?.length ? '/profile#photos' : '/profile#verify'} className="nudge">
          <span className="nudge-text"><Icon name={!user.photos?.length ? 'camera' : 'shield'} size={18} />
            {!user.photos?.length && !user.verified
              ? 'Add a photo and get verified. People trust profiles with both.'
              : !user.photos?.length
                ? 'Add a photo. Profiles with one get far more likes.'
                : 'Verify your college or work email to stand out.'}
          </span>
          <Icon name="chevron" size={18} />
        </Link>
      )}

      {error && <p className="error-box">{error}</p>}

      {current ? (
        <div className="dv-grid">
          <div className="dv-left">
            <div className={`dv-stack${next ? ' has-more' : ''}`}>
              <div
                key={current.user.id}
                className={`swipe-card dv-card${drag.active ? '' : ' animating'}`}
                style={{ transform: `translate(${drag.x}px, ${drag.y}px) rotate(${drag.x / 18}deg)` }}
                onPointerDown={onPointerDown}
                onClickCapture={onClickCapture}
              >
                <DiscoverCard
                  user={current.user}
                  compatibility={current.compatibility}
                  stamps={(
                    <>
                      <span className="stamp like" style={{ opacity: leaving === 'like' ? 1 : likeOpacity }}>LIKE</span>
                      <span className="stamp nope" style={{ opacity: leaving === 'pass' ? 1 : nopeOpacity }}>PASS</span>
                    </>
                  )}
                />
              </div>
            </div>

            <div className="swipe-actions">
              <button type="button" className="btn-round pass" onClick={() => decide('pass')} disabled={!!leaving} aria-label="Pass">
                <Icon name="x" size={30} strokeWidth={3} />
              </button>
              <button type="button" className="btn-round info" onClick={() => navigate(`/users/${current.user.id}`)} aria-label="Full comparison">
                <Icon name="sparkle" size={22} />
              </button>
              <button type="button" className="btn-round like" onClick={() => decide('like')} disabled={!!leaving} aria-label="Like">
                <Icon name="thumb" size={30} />
              </button>
            </div>
            <p className="kbd-hint">Drag the card, or press <kbd>←</kbd> to pass and <kbd>→</kbd> to like</p>
          </div>

          <MatchDetails key={current.user.id} user={current.user} compatibility={current.compatibility} />
        </div>
      ) : (
        <div className="card empty fade-up">
          <span className="icon-badge big"><Icon name="home" size={30} /></span>
          <h2>You've seen everyone for now</h2>
          <p className="muted">
            We only show people in <b>{user.city}</b> whose budget overlaps yours and who pass both people's
            dealbreakers{verifiedOnly ? ', and right now only verified people' : ''}. To see more, try widening your
            budget{verifiedOnly ? ', turning off "Verified only",' : ''} or making fewer things dealbreakers.
          </p>
          <div className="row gap center-row">
            <Link className="btn btn-ghost" to="/profile/edit">Edit preferences</Link>
            <Link className="btn btn-primary" to="/matches">Go to matches</Link>
          </div>
        </div>
      )}

      {match && <MatchModal match={match} onClose={() => setMatch(null)} />}
      {showTour && <Tour steps={TOUR_STEPS} onClose={closeTour} />}
    </div>
  );
}
