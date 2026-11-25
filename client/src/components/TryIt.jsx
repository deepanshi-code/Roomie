import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { formatINR, labelFor, scoreTone } from '../utils.js';
import { initials, nameGradient, vibeTags } from '../vibes.js';
import Icon from './Icon.jsx';
import VibeList from './VibeList.jsx';

/** The 4 habits a visitor answers on the landing page to get a quick match % with real people. */
const QUICK = ['sleep', 'dishes', 'guests', 'smoking'];

/** Quick match on the answered habits only, same ordinal similarity the real engine uses. */
function quickScore(values, mine, meta) {
  const sims = [];
  for (const qid of QUICK) {
    if (mine[qid] === undefined || values[qid] === undefined) continue;
    const steps = meta.questions.find((q) => q.id === qid).options.length - 1;
    sims.push(1 - Math.abs(mine[qid] - values[qid]) / steps);
  }
  return sims.length ? Math.round((sims.reduce((a, b) => a + b, 0) / sims.length) * 100) : null;
}

function PreviewCard({ p, score, leaving }) {
  const { meta } = useAuth();
  return (
    <article className={`card try-card${leaving ? ` leave-${leaving}` : ''}`}>
      <div className="try-hero" style={{ background: nameGradient(`${p.firstName}${p.age}`) }}>
        <span className="try-initial">{initials(p.firstName)}</span>
        <div className={`score-pill try-score tone-${score === null ? 'none' : scoreTone(score)}`}>
          {score === null ? <small>Answer to see<br />your match</small> : <><b>{score}%</b><small>quick<br />match</small></>}
        </div>
        <div className="try-name">
          <h3>{p.firstName} <span>{p.age}</span>{p.verified && <span className="try-verified" title={`Verified ${p.verified === 'student' ? 'student' : 'work email'}`}><Icon name="check" size={11} strokeWidth={3.5} /></span>}</h3>
          <p>{[p.occupation, p.area].filter(Boolean).join(' · ')}</p>
        </div>
      </div>
      <div className="try-body">
        <VibeList tags={vibeTags(p.values, 5)} />
        <div className="try-facts">
          <span><Icon name="wallet" size={15} />{formatINR(p.budgetMin)} – {formatINR(p.budgetMax)}</span>
          <span><Icon name="key" size={15} />{labelFor(meta?.housing, p.housing)}</span>
        </div>
        {p.interests.length > 0 && <div className="chips">{p.interests.map((i) => <span key={i} className="chip">{i}</span>)}</div>}
      </div>
    </article>
  );
}

export default function TryIt({ onJoin }) {
  const { meta } = useAuth();
  const [mine, setMine] = useState({});
  const [data, setData] = useState(null);
  const [city, setCity] = useState('');
  const [index, setIndex] = useState(0);
  const [leaving, setLeaving] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api(`/public/preview${city ? `?city=${encodeURIComponent(city)}` : ''}`)
      .then((d) => { if (!cancelled) { setData(d); setIndex(0); } })
      .catch(() => { if (!cancelled) setError('Could not load people right now.'); });
    return () => { cancelled = true; };
  }, [city]);

  const answered = Object.keys(mine).length;
  // Best quick matches first once the visitor has answered something.
  const people = useMemo(() => {
    if (!data || !meta) return [];
    const scored = data.people.map((p) => ({ p, score: quickScore(p.values, mine, meta) }));
    return answered ? [...scored].sort((a, b) => b.score - a.score) : scored;
  }, [data, mine, meta, answered]);

  const pick = (qid, value) => { setMine((m) => ({ ...m, [qid]: value })); setIndex(0); };

  function decide(action) {
    const current = people[index];
    if (!current || leaving) return;
    if (action === 'like') { onJoin(current.p.firstName); return; }
    setLeaving('pass');
    setTimeout(() => { setIndex((n) => n + 1); setLeaving(null); }, 320);
  }

  if (!meta) return null;
  const current = people[index];
  const next = people[index + 1];

  return (
    <div className="try">
      <div className="card try-questions reveal">
        <p className="eyebrow grad-text">Step 1 · Tell us 4 habits</p>
        {QUICK.map((qid) => {
          const q = meta.questions.find((x) => x.id === qid);
          return (
            <div key={qid} className="try-q">
              <h4>{q.text}</h4>
              <div className="try-options">
                {q.options.map((opt, idx) => (
                  <button key={opt} type="button" className={`try-opt${mine[qid] === idx ? ' on' : ''}`} onClick={() => pick(qid, idx)} aria-pressed={mine[qid] === idx}>
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        <p className="muted small try-note">
          {answered < QUICK.length
            ? `${answered}/${QUICK.length} answered. The full app uses 16 questions and how much each one matters to you.`
            : 'Nice! These are your best quick matches. The full app uses 16 questions for a more accurate score.'}
        </p>
      </div>

      <div className="try-deck-wrap reveal">
        <div className="try-deck-head">
          <p className="eyebrow grad-text">Step 2 · Swipe real people</p>
          {data?.cities.length > 1 && (
            <div className="try-cities" role="radiogroup" aria-label="City">
              {data.cities.map((c) => (
                <button key={c.city} type="button" role="radio" aria-checked={data.city === c.city}
                  className={`chip chip-btn${data.city === c.city ? ' chip-on' : ''}`} onClick={() => setCity(c.city)}>
                  {c.city}
                </button>
              ))}
            </div>
          )}
        </div>

        {error && <p className="error-box">{error}</p>}
        {!data && !error && <div className="center-pad"><div className="spinner" /></div>}

        {data && (current ? (
          <>
            <div className="try-deck">
              {next && <div className="try-under" aria-hidden><PreviewCard p={next.p} score={next.score} /></div>}
              <PreviewCard key={current.p.key} p={current.p} score={current.score} leaving={leaving} />
            </div>
            <div className="swipe-actions">
              <button type="button" className="btn-round pass" onClick={() => decide('pass')} aria-label={`Pass on ${current.p.firstName}`}><Icon name="x" size={26} strokeWidth={3} /></button>
              <button type="button" className="btn-round like" onClick={() => decide('like')} aria-label={`Like ${current.p.firstName}`}><Icon name="thumb" size={28} /></button>
            </div>
            <p className="muted small center">{index + 1} of {people.length} in {data.city} · first names only until you join</p>
          </>
        ) : (
          <div className="card empty try-end">
            <span className="icon-badge big"><Icon name="users" size={30} /></span>
            <h3>That's everyone in {data.city} for now</h3>
            <p className="muted">Sign up to see full profiles, real match scores and who likes you back.</p>
            <div className="row gap center-row">
              <button type="button" className="btn btn-primary" onClick={() => onJoin(null)}>Create my account</button>
              <button type="button" className="btn btn-ghost" onClick={() => setIndex(0)}>Start over</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
