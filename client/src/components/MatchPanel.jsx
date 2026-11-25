import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { CATEGORY_ICON } from '../vibes.js';
import { formatDate, formatINR, genderLabel } from '../utils.js';
import { useAuth } from '../context/AuthContext.jsx';
import Icon from './Icon.jsx';
import ScoreRing from './ScoreRing.jsx';
import VerifiedBadge from './VerifiedBadge.jsx';

/** Questions worth raising early: real conflicts first, otherwise the answers that differ most. */
export function talkingPoints(compatibility) {
  const rows = compatibility.conflicts.length
    ? compatibility.conflicts
    : compatibility.breakdown.filter((r) => r.weight > 0 && r.similarity < 1).sort((a, b) => a.similarity - b.similarity).slice(0, 2);
  return rows.map((r) => ({
    topic: r.question,
    category: r.category,
    you: r.you,
    them: r.them,
    prompt: `About ${r.question.toLowerCase()}: I'm "${r.you}" and you said "${r.them}". How would we make that work?`,
  }));
}

/** Right column of the chat: who they are, why you match, what to discuss, and next steps. */
export default function MatchPanel({ id, user, compatibility, onPrompt, onClose }) {
  const { meta } = useAuth();
  const [agreement, setAgreement] = useState(undefined);
  useEffect(() => {
    let cancelled = false;
    api(`/matches/${id}/agreement`).then((r) => { if (!cancelled) setAgreement(r.agreement); }).catch(() => { if (!cancelled) setAgreement(null); });
    return () => { cancelled = true; };
  }, [id]);

  const first = user.name.split(' ')[0];
  const points = talkingPoints(compatibility);
  const agreed = agreement && agreement.agreedByMe && agreement.agreedByThem;
  const agreementText = agreement === undefined ? 'Checking…'
    : agreed ? 'You both agreed to the house rules.'
      : agreement?.agreedByMe ? `Waiting for ${first} to agree.`
        : agreement?.agreedByThem ? `${first} agreed. Your turn to review.`
          : 'A draft based on both your answers is ready to edit.';

  return (
    <aside className="match-panel card" aria-label={`About ${first}`}>
      {onClose && (
        <button type="button" className="icon-btn mp-close" onClick={onClose} aria-label="Close details"><Icon name="x" size={18} /></button>
      )}
      <div className="mp-hero">
        <ScoreRing score={compatibility.score} size={92} />
        <div>
          <h2>{user.name}{user.age ? `, ${user.age}` : ''}</h2>
          <p className="muted small">{[genderLabel(meta, user.gender), user.occupation].filter(Boolean).join(' · ') || 'No details added'}</p>
          <VerifiedBadge verified={user.verified} compact />
        </div>
      </div>

      <dl className="mp-facts">
        <div><dt><Icon name="pin" size={15} />Area</dt><dd>{[user.area, user.city].filter(Boolean).join(', ') || '—'}</dd></div>
        <div><dt><Icon name="wallet" size={15} />Budget</dt><dd>{formatINR(user.budgetMin)} – {formatINR(user.budgetMax)}</dd></div>
        <div><dt><Icon name="calendar" size={15} />Move-in</dt><dd>{user.moveIn ? formatDate(user.moveIn) : 'Flexible'}</dd></div>
      </dl>

      {compatibility.strengths.length > 0 && (
        <section className="mp-section">
          <h3><Icon name="sparkle" size={16} />Why you click</h3>
          <ul className="mp-list">
            {compatibility.strengths.map((s) => (
              <li key={s.questionId}>
                <Icon name={CATEGORY_ICON[s.category] ?? 'check'} size={16} />
                <span><b>{s.question}</b><span className="muted">{s.you === s.them ? `Both: ${s.them}` : `${s.you} / ${s.them}`}</span></span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {points.length > 0 && (
        <section className="mp-section">
          <h3><Icon name="chat" size={16} />{compatibility.conflicts.length ? 'Talk about first' : 'Worth a quick chat'}</h3>
          <ul className="mp-list">
            {points.map((p) => (
              <li key={p.topic}>
                <Icon name={CATEGORY_ICON[p.category] ?? 'info'} size={16} />
                <span><b>{p.topic}</b><span className="muted">You: {p.you} · {first}: {p.them}</span></span>
                {onPrompt && <button type="button" className="mp-ask" onClick={() => onPrompt(p.prompt)}>Ask</button>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mp-section mp-agreement">
        <h3><Icon name="doc" size={16} />Roommate agreement</h3>
        <p className="muted small">{agreementText}</p>
        <Link to={`/agreement/${id}`} className={`btn btn-sm ${agreed ? 'btn-ghost' : 'btn-primary'}`}>{agreed ? 'View agreement' : 'Open agreement'}</Link>
      </section>

      <section className="mp-section mp-safety">
        <h3><Icon name="shield" size={16} />Before you meet</h3>
        <ul>
          <li>Meet somewhere public first and tell a friend.</li>
          <li>Visit the flat in person before agreeing to anything.</li>
          <li>Never pay a deposit before you have seen the place.</li>
        </ul>
      </section>

      <Link to={`/users/${user.id}`} className="mp-more">See full comparison <Icon name="chevron" size={16} /></Link>
    </aside>
  );
}
