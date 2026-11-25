import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { formatDate, formatINR, labelFor } from '../utils.js';
import Icon from './Icon.jsx';
import ScoreRing from './ScoreRing.jsx';

const matchWord = (score) => (score >= 75 ? 'great' : score >= 60 ? 'good' : score >= 45 ? 'fair' : 'weak');

/** The "why you'd match" panel next to the Discover card: everything you need to decide. */
export default function MatchDetails({ user, compatibility: c }) {
  const { meta } = useAuth();
  const first = user.name.split(' ')[0];
  const shared = (i) => c.sharedInterests.some((s) => s.toLowerCase() === i.toLowerCase());

  return (
    <aside className="dv-details card" aria-label={`Why you'd match with ${first}`}>
      <div className="dv-score">
        <ScoreRing score={c.score} size={72} />
        <div>
          <h3>A {matchWord(c.score)} match with {first}</h3>
          <p className="muted small">
            {first} fits what you care about <b>{c.fitsYou}%</b> · you fit what {first} cares about <b>{c.fitsThem}%</b>
          </p>
        </div>
      </div>

      <div className="dv-facts">
        <span className="fact"><Icon name="wallet" /><span><b>Budget</b>{formatINR(user.budgetMin)} – {formatINR(user.budgetMax)}</span></span>
        <span className="fact"><Icon name="calendar" /><span><b>Move-in</b>{formatDate(user.moveIn)}</span></span>
        <span className="fact"><Icon name="key" /><span><b>Housing</b>{labelFor(meta?.housing, user.housing)}</span></span>
      </div>

      {user.bio && <p className="bio">{user.bio}</p>}

      <div className="dv-columns">
        {c.strengths.length > 0 && (
          <section className="pc-section">
            <h3><Icon name="check" size={14} strokeWidth={3} /> Why you'd get along</h3>
            <ul className="reason-list">
              {c.strengths.map((s) => (
                <li key={s.questionId} className="reason good">
                  <span className="reason-q">{s.question}</span>
                  <span className="reason-a">{s.you === s.them ? s.you : `${s.you} · ${s.them}`}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        {c.conflicts.length > 0 && (
          <section className="pc-section">
            <h3><Icon name="chat" size={14} strokeWidth={2.5} /> Talk about these first</h3>
            <ul className="reason-list">
              {c.conflicts.map((s) => (
                <li key={s.questionId} className="reason warn">
                  <span className="reason-q">{s.question}</span>
                  <span className="reason-a">You: {s.you} · {first}: {s.them}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {user.interests?.length > 0 && (
        <section className="pc-section">
          <h3><Icon name="target" size={14} strokeWidth={2.5} /> Interests {c.sharedInterests.length > 0 && <span className="badge">{c.sharedInterests.length} in common</span>}</h3>
          <div className="chips">
            {user.interests.map((i) => <span key={i} className={`chip${shared(i) ? ' chip-shared' : ''}`}>{i}</span>)}
          </div>
        </section>
      )}

      <Link to={`/users/${user.id}`} className="btn btn-ghost btn-block">See every answer side by side <Icon name="chevron" size={16} /></Link>
    </aside>
  );
}
