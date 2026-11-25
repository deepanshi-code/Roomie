import { scoreTone } from '../utils.js';
import { CATEGORY_ICON } from '../vibes.js';
import Icon from './Icon.jsx';

function marker(sim) {
  if (sim >= 0.99) return { icon: '✓', label: 'Same', tone: 'good' };
  if (sim >= 0.5) return { icon: '≈', label: 'Close', tone: 'ok' };
  return { icon: '≠', label: 'Different', tone: 'low' };
}

/** Full, explainable comparison: summary tiles, then each category with side-by-side answers. */
export default function Breakdown({ compatibility: c, name = 'Them' }) {

  return (
    <section className="breakdown">
      <div className="bd-head">
        <h2>How you'd live together</h2>
        <p className="muted small">Every answer, side by side. ✓ same, ≈ close, ≠ worth a chat.</p>
      </div>

      <div className="bd-stats">
        <div className={`bd-stat tone-${scoreTone(c.score)}`}><b>{c.score}%</b><span>Overall match</span></div>
        <div className="bd-stat"><b>{c.fitsYou}%</b><span>{name} fits what you care about</span></div>
        <div className="bd-stat"><b>{c.fitsThem}%</b><span>You fit what {name} cares about</span></div>
        <div className="bd-stat"><b>{c.sharedInterests.length}</b><span>Shared interests</span></div>
      </div>

      {c.blockers.length > 0 && (
        <div className="blockers">
          <b><Icon name="alert" size={16} /> Normally hidden from Discover because:</b>
          <ul>{c.blockers.map((b) => <li key={b}>{b}</li>)}</ul>
        </div>
      )}

      {c.categories.filter((cat) => cat.score != null).map((cat) => (
        <div key={cat.id} className="card bd-cat">
          <div className="bd-cat-head">
            <span className="bd-cat-emoji" aria-hidden><Icon name={CATEGORY_ICON[cat.id]} size={18} /></span>
            <h3>{cat.label}</h3>
            <span className="bar"><span className={`bar-fill tone-${scoreTone(cat.score)}`} style={{ width: `${cat.score}%` }} /></span>
            <b className={`bd-cat-score tone-text-${scoreTone(cat.score)}`}>{cat.score}%</b>
          </div>
          <ul className="bd-rows">
            {c.breakdown.filter((r) => r.category === cat.id).map((r) => {
              const m = marker(r.similarity);
              return (
                <li key={r.questionId} className="bd-row">
                  <span className="bd-q">{r.question}</span>
                  <span className="bd-ans">{r.you}<em>You</em></span>
                  <span className={`bd-mark tone-${m.tone}`} title={m.label} aria-label={m.label}>{m.icon}</span>
                  <span className="bd-ans">{r.them}<em>{name}</em></span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}
