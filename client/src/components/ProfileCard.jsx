import { useAuth } from '../context/AuthContext.jsx';
import { formatDate, formatINR, labelFor } from '../utils.js';
import { initials, nameGradient, valuesFromBreakdown, vibeTags } from '../vibes.js';
import Icon from './Icon.jsx';
import PhotoGallery from './PhotoGallery.jsx';
import ScoreRing from './ScoreRing.jsx';
import VibeList from './VibeList.jsx';
import VerifiedBadge from './VerifiedBadge.jsx';

/** Big visual card: photo/gradient hero with name + score, then a scrollable body with details. */
export default function ProfileCard({ user, compatibility: c, children, stamps = null }) {
  const { meta } = useAuth();
  const vibes = vibeTags(valuesFromBreakdown(c.breakdown, meta));
  const shared = (i) => c.sharedInterests.some((s) => s.toLowerCase() === i.toLowerCase());

  return (
    <article className="card profile-card">
      <div className="pc-hero">
        {user.photos?.length ? (
          <PhotoGallery photos={user.photos} name={user.name} />
        ) : (
          <div className="pc-hero-bg" style={{ background: nameGradient(user.name) }} aria-hidden>
            <span className="pc-initials">{initials(user.name)}</span>
          </div>
        )}
        {stamps}
        <div className="score-pill" title={`${c.score}% compatible`}>
          <ScoreRing score={c.score} size={42} />
          <small>match<br />score</small>
        </div>
        <div className="pc-overlay">
          <h2>{user.name.split(' ')[0]} <span className="age">{user.age}</span> <VerifiedBadge verified={user.verified} compact /></h2>
          <div className="pc-sub">
            {user.occupation && <span><Icon name="user" size={15} />{user.occupation}</span>}
            <span><Icon name="pin" size={15} />{[user.area, user.city].filter(Boolean).join(', ')}</span>
          </div>
        </div>
      </div>

      <div className="pc-body">
        {user.verified && <VerifiedBadge verified={user.verified} />}

        <VibeList tags={vibes} />

        <div className="facts">
          <span className="fact"><Icon name="wallet" /><span><b>Budget</b>{formatINR(user.budgetMin)} – {formatINR(user.budgetMax)}</span></span>
          <span className="fact"><Icon name="calendar" /><span><b>Move-in</b>{formatDate(user.moveIn)}</span></span>
          <span className="fact"><Icon name="key" /><span><b>Housing</b>{labelFor(meta?.housing, user.housing)}</span></span>
        </div>

        {user.bio && <p className="bio">{user.bio}</p>}

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
                  <span className="reason-a">You: {s.you} · Them: {s.them}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {user.interests?.length > 0 && (
          <section className="pc-section">
            <h3><Icon name="target" size={14} strokeWidth={2.5} /> Interests {c.sharedInterests.length > 0 && <span className="badge">{c.sharedInterests.length} in common</span>}</h3>
            <div className="chips">
              {user.interests.map((i) => <span key={i} className={`chip${shared(i) ? ' chip-shared' : ''}`}>{i}</span>)}
            </div>
          </section>
        )}

        {children}
      </div>
    </article>
  );
}
