import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import Breakdown from '../components/Breakdown.jsx';
import Icon from '../components/Icon.jsx';
import MatchModal from '../components/MatchModal.jsx';
import { Basics, PfSection, PhotoFrame, identityLine } from '../components/ProfileParts.jsx';
import ScoreRing from '../components/ScoreRing.jsx';
import VerifiedBadge from '../components/VerifiedBadge.jsx';
import VibeList from '../components/VibeList.jsx';
import { valuesFromBreakdown, vibeTags } from '../vibes.js';

export default function UserProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { meta } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [match, setMatch] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setData(null);
    api(`/users/${id}`).then(setData).catch((e) => setError(e.message));
  }, [id]);

  async function swipe(action) {
    setBusy(true);
    try {
      const r = await api('/swipes', { method: 'POST', body: { toId: data.user.id, action } });
      if (r.matched) {
        setMatch({ user: data.user, matchId: r.matchId, score: data.compatibility.score });
        setData({ ...data, relation: { status: 'matched', matchId: r.matchId } });
      } else if (action === 'pass') {
        // Passing means "not for me": leave the profile, like swiping left on the card.
        // Discover reloads its deck, so this person is gone from it.
        if ((window.history.state?.idx ?? 0) > 0) navigate(-1);
        else navigate('/discover', { replace: true });
        return;
      } else {
        setData({ ...data, relation: { status: 'liked' } });
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (!data) return <div className="center-pad">{error ? <p className="error-box">{error}</p> : <div className="spinner" />}</div>;
  const { user, compatibility: c, relation } = data;
  const first = user.name.split(' ')[0];
  const vibes = vibeTags(valuesFromBreakdown(c.breakdown, meta), 8);
  const shared = (i) => c.sharedInterests.some((s) => s.toLowerCase() === i.toLowerCase());

  return (
    <div className="pf pf-other">
      <aside className="pf-side">
        <button type="button" className="link back-link" onClick={() => navigate(-1)}><Icon name="back" size={16} /> Back</button>
        <div className="card pf-id">
          <PhotoFrame user={user} gallery />
          <div className="pf-name">
            <h1>{first}{user.age ? <span className="pf-age">, {user.age}</span> : null}</h1>
            <VerifiedBadge verified={user.verified} compact />
          </div>
          <p className="pf-identity">{identityLine(user, meta)}</p>
          <p className="pf-place"><Icon name="pin" size={15} />{[user.area, user.city].filter(Boolean).join(', ')}</p>

          <div className="pf-score">
            <ScoreRing score={c.score} size={60} />
            <div>
              <b>{c.score}% compatible</b>
              <span className="muted small">{first} fits your priorities {c.fitsYou}% · you fit theirs {c.fitsThem}%</span>
            </div>
          </div>

          <div className="pf-cta">
            {relation.status === 'matched' && (
              <>
                <p className="pf-status"><Icon name="check" size={15} />You matched with {first}</p>
                <Link className="btn btn-primary" to={`/chat/${relation.matchId}`}><Icon name="send" size={17} />Message</Link>
              </>
            )}
            {relation.status === 'liked' && <p className="pf-status"><Icon name="clock" size={15} />You liked {first}. If they like you back, you can chat.</p>}
            {relation.status === 'none' && (
              <div className="pf-cta-row">
                <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => swipe('pass')}><Icon name="x" size={17} />Pass</button>
                <button type="button" className="btn btn-primary" disabled={busy} onClick={() => swipe('like')}>
                  <Icon name="thumb" size={17} />Like
                </button>
              </div>
            )}
            {relation.status === 'passed' && (
              <div className="pf-passed">
                <p className="pf-status"><Icon name="x" size={15} />You passed on {first}. They won't show up in Discover.</p>
                <button type="button" className="link" disabled={busy} onClick={() => swipe('like')}>Undo and like instead</button>
              </div>
            )}
            {error && <p className="error-box">{error}</p>}
          </div>
        </div>
      </aside>

      <div className="pf-main">
        <PfSection title={`About ${first}`}>
          <Basics user={user} meta={meta} />
          {user.bio && <div className="pf-block"><h3>Bio</h3><p className="pf-bio">{user.bio}</p></div>}
          {vibes.length > 0 && <div className="pf-block"><h3>Lifestyle at a glance</h3><VibeList tags={vibes} /></div>}
          {user.interests?.length > 0 && (
            <div className="pf-block">
              <h3>Interests {c.sharedInterests.length > 0 && <span className="pf-common">{c.sharedInterests.length} in common</span>}</h3>
              <div className="pf-tags">{user.interests.map((i) => <span key={i} className={`pf-tag${shared(i) ? ' shared' : ''}`}>{i}</span>)}</div>
            </div>
          )}
        </PfSection>

        {(c.strengths.length > 0 || c.conflicts.length > 0) && (
          <PfSection title="At a glance">
            <div className="pf-glance">
              {c.strengths.length > 0 && (
                <div>
                  <h3 className="good"><Icon name="check" size={16} />Where you agree</h3>
                  <ul>{c.strengths.map((s) => <li key={s.questionId}><b>{s.question}</b><span>{s.you === s.them ? s.them : `${s.you} / ${s.them}`}</span></li>)}</ul>
                </div>
              )}
              {c.conflicts.length > 0 && (
                <div>
                  <h3 className="warn"><Icon name="chat" size={16} />Talk about first</h3>
                  <ul>{c.conflicts.map((s) => <li key={s.questionId}><b>{s.question}</b><span>You: {s.you} · {first}: {s.them}</span></li>)}</ul>
                </div>
              )}
            </div>
          </PfSection>
        )}

        <Breakdown compatibility={c} name={first} />
      </div>
      {match && <MatchModal match={match} onClose={() => setMatch(null)} />}
    </div>
  );
}
