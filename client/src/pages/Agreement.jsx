import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocketEvent } from '../context/SocketContext.jsx';
import Icon from '../components/Icon.jsx';

const STATUS = {
  aligned: { label: 'Same answers', short: 'Same', tone: 'good' },
  compromise: { label: 'Small difference', short: 'Compromise', tone: 'ok' },
  discuss: { label: 'Big difference: talk it through', short: 'Discuss', tone: 'low' },
  standard: { label: 'Standard rule', short: 'Standard', tone: 'neutral' },
  custom: { label: 'Added by you two', short: 'Custom', tone: 'neutral' },
};

const sameClauses = (a, b) => JSON.stringify(a.map(({ id, title, text }) => [id, title, text]))
  === JSON.stringify(b.map(({ id, title, text }) => [id, title, text]));
const formatDay = (iso) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

/** Clauses grouped into one section per topic (in order of first appearance), numbered in reading order. */
function sections(clauses) {
  const byTopic = new Map();
  for (const c of clauses) {
    const topic = c.topic || 'Other';
    if (!byTopic.has(topic)) byTopic.set(topic, []);
    byTopic.get(topic).push(c);
  }
  let n = 0;
  return [...byTopic].map(([topic, items]) => ({ topic, items: items.map((c) => ({ c, n: ++n })) }));
}

export default function Agreement() {
  const { matchId } = useParams();
  const id = Number(matchId);
  const { user } = useAuth();
  const [other, setOther] = useState(null);
  const [agreement, setAgreement] = useState(null);
  const [draft, setDraft] = useState([]);
  const [editing, setEditing] = useState(null); // key of the clause being edited
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const tempId = useRef(0);

  const dirty = agreement ? !sameClauses(draft, agreement.clauses) : false;
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  const apply = useCallback((a) => {
    setAgreement(a);
    setDraft(a.clauses.map((c) => ({ ...c, key: c.id })));
    setEditing(null);
  }, []);

  const load = useCallback(async () => {
    try {
      const [m, a] = await Promise.all([api(`/matches/${id}`), api(`/matches/${id}/agreement`)]);
      setOther(m.user);
      apply(a.agreement);
    } catch (e) {
      setError(e.message);
    }
  }, [id, apply]);

  useEffect(() => { load(); }, [load]);

  useSocketEvent('agreement:updated', async (e) => {
    if (e.matchId !== id) return;
    if (dirtyRef.current) {
      setNotice(`${other?.name ?? 'Your roommate'} just changed the agreement. Save or discard your edits to see their version.`);
      return;
    }
    const { agreement: next } = await api(`/matches/${id}/agreement`);
    const name = other?.name.split(' ')[0] ?? 'Your roommate';
    const onlyAgreed = agreement && next.version === agreement.version && next.agreedByThem && !agreement.agreedByThem;
    apply(next);
    setNotice(onlyAgreed ? `${name} agreed to the rules.` : `${name} edited the agreement. Earlier agreements were cleared.`);
  });

  async function run(path, body) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const r = await api(path, { method: body.clauses ? 'PUT' : 'POST', body });
      apply(r.agreement);
      return true;
    } catch (e) {
      setError(e.message);
      if (e.status === 409) await load();
      return false;
    } finally {
      setBusy(false);
    }
  }

  const save = () => run(`/matches/${id}/agreement`, {
    version: agreement.version,
    clauses: draft.map(({ id: cid, title, text }) => ({ id: cid, title, text })),
  });
  const agree = () => run(`/matches/${id}/agreement/agree`, { version: agreement.version });
  const regenerate = () => {
    if (window.confirm('Rebuild the draft from both your current answers? All edits and agreements will be lost.')) {
      run(`/matches/${id}/agreement/regenerate`, { version: agreement.version });
    }
  };

  const update = (key, patch) => setDraft((d) => d.map((c) => (c.key === key ? { ...c, ...patch } : c)));
  const remove = (key) => setDraft((d) => d.filter((c) => c.key !== key));
  const addRule = () => {
    tempId.current += 1;
    const key = `new-${tempId.current}`;
    setDraft((d) => [...d, { key, id: null, topic: 'Your own rules', title: '', text: '', status: 'custom', basis: [] }]);
    setEditing(key);
    setTimeout(() => document.getElementById(`clause-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
  };
  const jumpTo = (key) => document.getElementById(`clause-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });

  if (!agreement || !other) {
    return <div className="center-pad">{error ? <p className="error-box">{error}</p> : <div className="spinner" />}</div>;
  }

  const firstName = other.name.split(' ')[0];
  const nameFor = (uid) => (uid === user.id ? 'You' : firstName);
  const both = agreement.agreedByMe && agreement.agreedByThem;
  const agreedCount = [agreement.agreedByMe, agreement.agreedByThem].filter(Boolean).length;
  const counts = draft.reduce((acc, c) => ({ ...acc, [c.status]: (acc[c.status] ?? 0) + 1 }), {});
  const invalid = draft.some((c) => !c.title.trim() || !c.text.trim());
  const toDiscuss = draft.filter((c) => c.status === 'discuss' || c.status === 'compromise');
  const blanks = draft.filter((c) => /_{3,}/.test(c.text));

  let statusText;
  if (both) statusText = `You both agreed on ${formatDay([agreement.agreedByMe, agreement.agreedByThem].sort()[1])}.`;
  else if (agreement.agreedByMe) statusText = `You agreed. Waiting for ${firstName}.`;
  else if (agreement.agreedByThem) statusText = `${firstName} agreed. Read it through, then agree to make it official.`;
  else statusText = 'Neither of you has agreed yet.';

  const Signature = ({ name, agreedAt }) => (
    <div className={`ag-sign${agreedAt ? ' signed' : ''}`}>
      <span className="ag-sign-line">{agreedAt ? name : ''}</span>
      <b>{name}</b>
      <span className="small">{agreedAt ? `Agreed on ${formatDay(agreedAt)}` : 'Not agreed yet'}</span>
    </div>
  );

  return (
    <div className={`ag${both ? ' is-signed' : ''}`}>
      <div className="ag-crumbs no-print">
        <Link to={`/chat/${id}`} className="link back-link"><Icon name="back" size={16} /> Back to chat with {firstName}</Link>
      </div>

      <div className="ag-layout">
        <article className="ag-doc card">
          <header className="ag-doc-head">
            <p className="ag-kicker">Roommate agreement · Version {agreement.version}</p>
            <h1>House rules</h1>
            <p className="ag-parties">Between <b>{user.name}</b> and <b>{other.name}</b></p>
            <p className="ag-note">
              Drafted from both your lifestyle answers. Edit anything, add your own rules, and agree once it feels fair.
              This is a shared understanding between roommates, not a legal contract. Rent, deposit and lease terms belong
              in your rental agreement with the owner.
            </p>
            <p className="print-only small">Status: {statusText}</p>
          </header>

          {notice && <p className="info-box no-print">{notice}</p>}

          {sections(draft).map((sec) => (
            <section key={sec.topic + sec.items[0].n} className="ag-section">
              <h2>{sec.topic}</h2>
              <ol className="ag-clauses">
                {sec.items.map(({ c, n }) => {
                  const st = STATUS[c.status] ?? STATUS.custom;
                  const isEditing = editing === c.key;
                  return (
                    <li key={c.key} id={`clause-${c.key}`} className={`ag-clause${isEditing ? ' is-editing' : ''}`}>
                      <span className="ag-num">{n}.</span>
                      <div className="ag-body">
                        {isEditing ? (
                          <div className="ag-edit no-print">
                            <input value={c.title} maxLength={80} placeholder="Rule title" onChange={(e) => update(c.key, { title: e.target.value })} aria-label="Rule title" autoFocus />
                            <textarea rows={4} value={c.text} maxLength={600} placeholder="What you both agree to…" onChange={(e) => update(c.key, { text: e.target.value })} aria-label="Rule text" />
                            <div className="row gap">
                              <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing(null)}><Icon name="check" size={16} /> Done</button>
                              <button type="button" className="btn btn-ghost btn-sm danger-text" onClick={() => remove(c.key)}>Remove rule</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="ag-title-row">
                              <h3>{c.title || <span className="muted">Untitled rule</span>}</h3>
                              <span className={`ag-tag tone-${st.tone} no-print`} title={st.label}>{st.short}</span>
                              {c.edited && c.status !== 'custom' && <span className="ag-tag tone-neutral no-print">Edited</span>}
                              <button type="button" className="ag-edit-btn no-print" onClick={() => setEditing(c.key)} aria-label={`Edit rule: ${c.title}`}>
                                <Icon name="edit" size={15} />Edit
                              </button>
                            </div>
                            <p className="ag-text">{c.text || <span className="muted">No text yet</span>}</p>
                            {c.basis?.length > 0 && (
                              <details className="ag-why no-print">
                                <summary>Why this rule</summary>
                                <p>{c.rationale}</p>
                                <ul>
                                  {c.basis.map((b) => (
                                    <li key={b.question}>
                                      <b>{b.question}:</b> {b.answers.map((x) => `${nameFor(x.userId)}: ${x.answer}`).join(' · ')}
                                    </li>
                                  ))}
                                </ul>
                              </details>
                            )}
                            {!c.basis?.length && c.rationale && <p className="ag-hint no-print">{c.rationale}</p>}
                          </>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}

          <button type="button" className="ag-add no-print" onClick={addRule}>
            <Icon name="edit" size={16} /> Add your own rule
          </button>

          <footer className="ag-signatures">
            <h2>Agreed by</h2>
            <div className="ag-sign-row">
              {Signature({ name: user.name, agreedAt: agreement.agreedByMe })}
              {Signature({ name: other.name, agreedAt: agreement.agreedByThem })}
            </div>
          </footer>
        </article>

        <aside className="ag-side no-print">
          <div className="card ag-panel">
            {dirty ? (
              <>
                <p className="ag-panel-label">Unsaved changes</p>
                <p className="small muted">Saving creates a new version and clears any earlier agreements, so you both read the final text.</p>
                {invalid && <p className="small ag-warn">Every rule needs a title and text before you can save.</p>}
                <div className="ag-panel-actions">
                  <button type="button" className="btn btn-primary" onClick={save} disabled={busy || invalid}>{busy ? 'Saving…' : 'Save changes'}</button>
                  <button type="button" className="btn btn-ghost" onClick={() => apply(agreement)} disabled={busy}>Discard</button>
                </div>
              </>
            ) : (
              <>
                <p className="ag-panel-label">{both ? 'Agreed' : 'Status'}</p>
                <div className="ag-progress">
                  <div className="ag-meter"><span style={{ width: `${agreedCount * 50}%` }} /></div>
                  <span className="small"><b>{agreedCount} of 2</b> agreed</span>
                </div>
                <ul className="ag-people">
                  <li className={agreement.agreedByMe ? 'ok' : ''}><span className="ag-dot" />You<small>{agreement.agreedByMe ? formatDay(agreement.agreedByMe) : 'Not yet'}</small></li>
                  <li className={agreement.agreedByThem ? 'ok' : ''}><span className="ag-dot" />{firstName}<small>{agreement.agreedByThem ? formatDay(agreement.agreedByThem) : 'Not yet'}</small></li>
                </ul>
                <p className="small muted">{statusText}</p>
                {!agreement.agreedByMe && (
                  <button type="button" className="btn btn-primary ag-agree" onClick={agree} disabled={busy}><Icon name="check" size={17} /> I agree to these rules</button>
                )}
              </>
            )}
            {error && <p className="error-box">{error}</p>}
          </div>

          {!both && (toDiscuss.length > 0 || blanks.length > 0) && (
            <div className="card ag-panel">
              <p className="ag-panel-label">Before you agree</p>
              <ul className="ag-todo">
                {toDiscuss.map((c) => (
                  <li key={c.key}><button type="button" onClick={() => jumpTo(c.key)}><span className={`ag-tag tone-${STATUS[c.status].tone}`}>{STATUS[c.status].short}</span>{c.title}</button></li>
                ))}
                {blanks.map((c) => (
                  <li key={`b-${c.key}`}><button type="button" onClick={() => jumpTo(c.key)}><span className="ag-tag tone-neutral">Fill in</span>{c.title}</button></li>
                ))}
              </ul>
              <p className="small muted">Talk these through in chat; the rest are things you already agree on ({counts.aligned ?? 0}) or standard rules.</p>
            </div>
          )}

          <div className="card ag-panel ag-tools">
            <button type="button" onClick={addRule}><Icon name="edit" size={16} />Add a rule</button>
            <button type="button" onClick={() => window.print()}><Icon name="doc" size={16} />Print or save as PDF</button>
            <button type="button" onClick={regenerate} disabled={busy}><Icon name="sparkle" size={16} />Rebuild from answers</button>
          </div>
        </aside>
      </div>

      {/* Phones: the main action stays reachable at the bottom */}
      <div className="ag-mobile-bar no-print">
        {dirty ? (
          <>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => apply(agreement)} disabled={busy}>Discard</button>
            <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={busy || invalid}>{busy ? 'Saving…' : 'Save changes'}</button>
          </>
        ) : (
          <>
            <span className="small"><b>{agreedCount} of 2</b> agreed</span>
            {!agreement.agreedByMe
              ? <button type="button" className="btn btn-primary btn-sm" onClick={agree} disabled={busy}><Icon name="check" size={16} /> I agree</button>
              : <span className="small muted">{both ? 'Agreed by both' : `Waiting for ${firstName}`}</span>}
          </>
        )}
      </div>
    </div>
  );
}
