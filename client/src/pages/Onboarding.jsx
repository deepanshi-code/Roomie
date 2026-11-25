import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import Icon from '../components/Icon.jsx';
import PhotoManager from '../components/PhotoManager.jsx';
import VibeList from '../components/VibeList.jsx';
import { CATEGORY_ICON, valuesFromAnswers, vibeTags } from '../vibes.js';

const MAX_INTERESTS = 10;
const STEP_META = {
  basics: { icon: 'user', title: 'The basics', short: 'Basics', intro: 'Who you are, where you want to live, and what you can spend.' },
  about: { icon: 'camera', title: 'About you', short: 'About', intro: 'A photo, a few words and your interests. This is what makes people say hi.' },
  review: { icon: 'check', title: 'Review', short: 'Review', intro: "Here's how you'll come across. You can change anything later." },
};
const CATEGORY_INTRO = {
  schedule: 'When you sleep, wake and are at home.',
  cleanliness: 'Be honest here. This is where most roommate fights start.',
  social: 'Guests, noise, and how close you want to be.',
  habits: 'Smoking, drinking and the kitchen.',
  home: 'Pets and splitting money.',
};

function initialState(user) {
  return {
    age: user.age ?? '',
    gender: user.gender ?? '',
    showGender: user.showGender ?? true,
    occupation: user.occupation ?? '',
    city: user.city ?? '',
    area: user.area ?? '',
    budgetMin: user.budgetMin ?? '',
    budgetMax: user.budgetMax ?? '',
    moveIn: user.moveIn ?? '',
    housing: user.housing ?? '',
    genderPref: user.genderPref ?? 'any',
    bio: user.bio ?? '',
    interests: user.interests ?? [],
    answers: user.answers ?? {},
  };
}

function FieldLabel({ children, optional }) {
  return <span className="field-label">{children}{optional && <span className="muted"> · optional</span>}</span>;
}

/** A checklist row: a tick when done, otherwise the tip (or the label) next to an empty box. */
function CheckItem({ ok, tip, children }) {
  if (ok) return <li className="ok"><span className="ob2-tick"><Icon name="check" size={13} strokeWidth={3} /></span>{children}</li>;
  return <li className="todo"><span className="ob2-tick" />{tip ?? children}</li>;
}

/** Pick-one list drawn as tiles with a radio mark. They stay real buttons, so keyboards work. */
function Choice({ options, value, onPick, columns }) {
  return (
    <div className="ob2-choices" style={columns ? { '--cols': columns } : undefined}>
      {options.map((o) => (
        <button type="button" key={o.id} className={`ob2-choice${value === o.id ? ' on' : ''}`} onClick={() => onPick(o.id)} aria-pressed={value === o.id}>
          <span className="ob2-radio" aria-hidden />
          <span>{o.label}</span>
        </button>
      ))}
    </div>
  );
}

/** Used for first-time setup (mode="setup") and for editing later (mode="edit"). */
export default function Onboarding({ mode }) {
  const editing = mode === 'edit';
  const { user, setUser, meta, logout } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(() => initialState(user));
  const [step, setStep] = useState(0);
  const [maxStep, setMaxStep] = useState(0); // furthest step reached (setup mode can only jump back to these)
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [customInterest, setCustomInterest] = useState('');

  const steps = useMemo(() => [
    { id: 'basics', ...STEP_META.basics },
    { id: 'about', ...STEP_META.about },
    ...meta.categories.map((c) => ({
      id: c.id, title: c.label, short: c.label.split(' ')[0], icon: CATEGORY_ICON[c.id], intro: CATEGORY_INTRO[c.id], category: true,
    })),
    { id: 'review', ...STEP_META.review },
  ], [meta]);
  const current = steps[step];
  const isLast = step === steps.length - 1;

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  function validate(id) {
    if (id === 'basics') {
      if (!form.age || form.age < 18) return 'You must be 18 or older';
      if (!form.gender) return 'Select your gender';
      if (!form.city.trim()) return 'Enter your city';
      if (form.budgetMin === '' || form.budgetMax === '') return 'Enter your budget range';
      if (Number(form.budgetMin) > Number(form.budgetMax)) return 'Your minimum budget is more than your maximum';
      if (!form.housing) return 'Tell us your housing situation';
    }
    const cat = meta.categories.find((c) => c.id === id);
    if (cat) {
      const missing = meta.questions.filter((q) => q.category === id && !Number.isInteger(form.answers[q.id]?.value));
      if (missing.length) return `Still to answer: ${missing.map((q) => q.short.toLowerCase()).join(', ')}`;
    }
    return '';
  }
  const stepDone = (id) => id !== 'review' && !validate(id);

  function goTo(i) {
    setError('');
    setStep(i);
    setMaxStep((m) => Math.max(m, i));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function next() {
    const msg = validate(current.id);
    if (msg) { setError(msg); return; }
    if (isLast) save();
    else goTo(step + 1);
  }

  async function save() {
    // Check every step, and jump to the first one with a problem.
    for (const [i, s] of steps.entries()) {
      const msg = validate(s.id);
      if (msg) { goTo(i); setError(msg); return; }
    }
    setBusy(true);
    setError('');
    try {
      const body = { ...form, age: Number(form.age), budgetMin: Number(form.budgetMin), budgetMax: Number(form.budgetMax) };
      const data = await api('/me', { method: 'PUT', body });
      setUser(data.user);
      navigate(editing ? '/profile' : '/discover');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function setAnswer(qid, patch) {
    const wasAnswered = Number.isInteger(form.answers[qid]?.value);
    setForm((f) => ({
      ...f,
      answers: { ...f.answers, [qid]: { importance: 2, dealbreaker: false, ...f.answers[qid], ...patch } },
    }));
    if (error) setError('');
    // After answering a question for the first time, glide to the next unanswered one.
    if (!wasAnswered && patch.value !== undefined) {
      const qs = meta.questions.filter((q) => q.category === current.id);
      const nextQ = qs.slice(qs.findIndex((q) => q.id === qid) + 1).find((q) => !Number.isInteger(form.answers[q.id]?.value));
      if (nextQ) setTimeout(() => document.getElementById(`q-${nextQ.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150);
    }
  }

  function toggleInterest(i) {
    const has = form.interests.includes(i);
    if (!has && form.interests.length >= MAX_INTERESTS) { setError(`Pick up to ${MAX_INTERESTS} interests`); return; }
    setError('');
    set('interests', has ? form.interests.filter((x) => x !== i) : [...form.interests, i]);
  }

  function addCustomInterest(e) {
    e.preventDefault();
    const v = customInterest.trim();
    if (v && !form.interests.includes(v)) toggleInterest(v);
    setCustomInterest('');
  }

  function onKeyDown(e) {
    if (e.key !== 'Enter' || e.defaultPrevented || e.target.closest('textarea, button')) return;
    e.preventDefault();
    next();
  }

  const allInterestOptions = [...new Set([...meta.interests, ...form.interests])];
  const categoryQs = current.category ? meta.questions.filter((q) => q.category === current.id) : [];
  const answeredHere = categoryQs.filter((q) => Number.isInteger(form.answers[q.id]?.value)).length;
  const vibes = vibeTags(valuesFromAnswers(form.answers), 10);
  const dealbreakers = meta.questions.filter((q) => form.answers[q.id]?.dealbreaker);
  const doneCount = steps.filter((s) => s.id !== 'review' && stepDone(s.id)).length;
  const totalCount = steps.length - 1;

  function stepStatus(s) {
    if (s.category) {
      const qs = meta.questions.filter((q) => q.category === s.id);
      const n = qs.filter((q) => Number.isInteger(form.answers[q.id]?.value)).length;
      return n === qs.length ? 'Done' : `${n} of ${qs.length} answered`;
    }
    if (s.id === 'review') return 'Check and finish';
    if (s.id === 'about') return 'Photos, bio, interests';
    return stepDone(s.id) ? 'Done' : 'Required';
  }

  return (
    <div className={`ob2${editing ? ' editing' : ' setup'}`}>
      <header className="ob2-top">
        {editing ? (
          <div>
            <h1>Edit profile</h1>
            <p className="muted small">Nothing changes until you press Save.</p>
          </div>
        ) : (
          <div className="brand"><span className="brand-mark"><Icon name="home" size={20} /></span><span className="grad-text">Roomie</span></div>
        )}
        {editing
          ? <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('/profile')}>Cancel</button>
          : <button type="button" className="btn btn-ghost btn-sm" onClick={logout}>Log out</button>}
      </header>

      <div className="ob2-layout">
        <aside className="ob2-side card">
          <div className="ob2-side-head">
            <b>{editing ? 'Sections' : 'Set up your profile'}</b>
            <span className="muted small">{doneCount} of {totalCount} complete</span>
            <div className="ob2-meter"><span style={{ width: `${(doneCount / totalCount) * 100}%` }} /></div>
          </div>
          <ol className="ob2-steps" aria-label="Steps">
            {steps.map((s, i) => {
              const reachable = editing || i <= maxStep;
              const done = stepDone(s.id) && reachable;
              return (
                <li key={s.id}>
                  <button
                    type="button" disabled={!reachable} onClick={() => goTo(i)}
                    className={`ob2-step${i === step ? ' current' : ''}${done ? ' done' : ''}`}
                    aria-current={i === step ? 'step' : undefined}
                  >
                    <span className="ob2-step-num">{done && i !== step ? <Icon name="check" size={13} strokeWidth={3} /> : i + 1}</span>
                    <span className="ob2-step-text"><b>{s.title}</b><small>{stepStatus(s)}</small></span>
                  </button>
                </li>
              );
            })}
          </ol>
        </aside>

        <section key={current.id} className="ob2-card card" onKeyDown={onKeyDown} aria-labelledby="ob2-title">
          <header className="ob2-card-head">
            <p className="ob2-eyebrow">Step {step + 1} of {steps.length}</p>
            <h2 id="ob2-title">{current.title}</h2>
            <p className="muted">{current.intro}</p>
            <div className="ob2-meter ob2-mobile-meter" aria-hidden><span style={{ width: `${((step + 1) / steps.length) * 100}%` }} /></div>
          </header>

          {current.id === 'basics' && (
            <div className="ob2-form">
              <div className="ob2-group">
                <h3>About you</h3>
                <div className="ob2-grid">
                  <label className="field"><FieldLabel>Age</FieldLabel>
                    <input type="number" min={18} max={99} value={form.age} onChange={(e) => set('age', e.target.value)} placeholder="21" />
                  </label>
                  <label className="field"><FieldLabel optional>Occupation</FieldLabel>
                    <input value={form.occupation} onChange={(e) => set('occupation', e.target.value)} placeholder="Student, engineer…" />
                  </label>
                </div>
                <div className="field">
                  <FieldLabel>Gender</FieldLabel>
                  <Choice options={meta.genders} value={form.gender} onPick={(v) => set('gender', v)} columns={4} />
                  {form.gender && form.gender !== 'prefer_not' && (
                    <label className="ob2-check">
                      <input type="checkbox" checked={form.showGender} onChange={(e) => set('showGender', e.target.checked)} />
                      <span>Show my gender on my profile<small className="muted">If hidden, it is still used for "same gender only" matching.</small></span>
                    </label>
                  )}
                </div>
              </div>

              <div className="ob2-group">
                <h3>Where and when</h3>
                <div className="ob2-grid">
                  <label className="field"><FieldLabel>City</FieldLabel>
                    <input value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="e.g. Dehradun" />
                  </label>
                  <label className="field"><FieldLabel optional>Preferred area</FieldLabel>
                    <input value={form.area} onChange={(e) => set('area', e.target.value)} placeholder="e.g. Clement Town" />
                  </label>
                  <div className="field">
                    <FieldLabel>Your share of rent per month</FieldLabel>
                    <div className="budget-row">
                      <div className="input-prefix"><span>₹</span>
                        <input type="number" min={0} step={500} value={form.budgetMin} onChange={(e) => set('budgetMin', e.target.value)} placeholder="5,000" aria-label="Budget from" />
                      </div>
                      <span className="muted">to</span>
                      <div className="input-prefix"><span>₹</span>
                        <input type="number" min={0} step={500} value={form.budgetMax} onChange={(e) => set('budgetMax', e.target.value)} placeholder="10,000" aria-label="Budget up to" />
                      </div>
                    </div>
                  </div>
                  <label className="field"><FieldLabel optional>Move-in date</FieldLabel>
                    <input type="date" value={form.moveIn || ''} onChange={(e) => set('moveIn', e.target.value)} />
                  </label>
                </div>
              </div>

              <div className="ob2-group">
                <h3>What you're looking for</h3>
                <div className="field">
                  <FieldLabel>Housing situation</FieldLabel>
                  <Choice options={meta.housing} value={form.housing} onPick={(v) => set('housing', v)} columns={3} />
                </div>
                <div className="field">
                  <FieldLabel>Roommate gender</FieldLabel>
                  <Choice options={meta.genderPrefs} value={form.genderPref} onPick={(v) => set('genderPref', v)} columns={2} />
                </div>
              </div>
            </div>
          )}

          {current.id === 'about' && (
            <div className="ob2-form">
              <div className="ob2-group">
                <h3>Photos <span className="muted">· recommended</span></h3>
                <PhotoManager />
              </div>
              <div className="ob2-group">
                <label className="field"><FieldLabel>Short bio</FieldLabel>
                  <textarea rows={4} maxLength={500} value={form.bio} onChange={(e) => set('bio', e.target.value)}
                    placeholder="What's a normal day like for you? What makes a great roommate?" />
                  <span className="muted small right">{form.bio.length}/500</span>
                </label>
              </div>
              <div className="ob2-group">
                <h3>Interests <span className="muted">· {form.interests.length}/{MAX_INTERESTS}</span></h3>
                <div className="ob2-tags">
                  {allInterestOptions.map((i) => (
                    <button type="button" key={i} className={`ob2-tag${form.interests.includes(i) ? ' on' : ''}`} onClick={() => toggleInterest(i)} aria-pressed={form.interests.includes(i)}>
                      {form.interests.includes(i) && <Icon name="check" size={13} strokeWidth={3} />}{i}
                    </button>
                  ))}
                </div>
                <div className="row gap">
                  <input value={customInterest} onChange={(e) => setCustomInterest(e.target.value)} maxLength={30}
                    placeholder="Add your own…" className="grow" onKeyDown={(e) => { if (e.key === 'Enter') addCustomInterest(e); }} />
                  <button type="button" className="btn btn-ghost" onClick={addCustomInterest}>Add</button>
                </div>
              </div>
            </div>
          )}

          {current.category && (
            <div className="ob2-form">
              <div className="ob2-help">
                <Icon name="info" size={16} />
                <p>
                  Pick what's closest to how you actually live. <b>How much it matters</b> sets how strongly the question
                  counts in your match score. <b>Dealbreaker</b> hides people whose answer is more than one step from
                  yours, so keep it for things you truly can't live with. <span className="ob2-count">{answeredHere} of {categoryQs.length} answered</span>
                </p>
              </div>
              {categoryQs.map((q, qi) => {
                const a = form.answers[q.id] ?? {};
                const answered = Number.isInteger(a.value);
                return (
                  <div key={q.id} id={`q-${q.id}`} className={`ob2-q${answered ? ' answered' : ''}`}>
                    <h3><span className="ob2-q-num">{answered ? <Icon name="check" size={12} strokeWidth={3} /> : qi + 1}</span>{q.text}</h3>
                    <Choice options={q.options.map((label, idx) => ({ id: idx, label }))} value={a.value} onPick={(idx) => setAnswer(q.id, { value: idx })} />
                    {answered && (
                      <div className="ob2-weight">
                        <span className="muted small">How much does it matter?</span>
                        <div className="ob2-seg" role="group" aria-label="How much it matters">
                          {meta.importanceLabels.map((label, idx) => (
                            <button type="button" key={label} className={(a.importance ?? 2) === idx ? 'on' : ''} onClick={() => setAnswer(q.id, { importance: idx })} aria-pressed={(a.importance ?? 2) === idx}>
                              {label}
                            </button>
                          ))}
                        </div>
                        <label className={`ob2-deal${a.dealbreaker ? ' on' : ''}`}>
                          <input type="checkbox" checked={!!a.dealbreaker} onChange={(e) => setAnswer(q.id, { dealbreaker: e.target.checked })} />
                          Dealbreaker
                        </label>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {current.id === 'review' && (
            <div className="ob2-form">
              <div className="ob2-group">
                <h3>Your lifestyle at a glance</h3>
                <VibeList tags={vibes} />
              </div>
              <div className="ob2-group">
                <h3>Checklist</h3>
                <ul className="ob2-checklist">
                  <CheckItem ok={stepDone('basics')}>Basics: {form.city || 'no city yet'}, ₹{form.budgetMin || '?'}–{form.budgetMax || '?'}</CheckItem>
                  <CheckItem ok={meta.categories.every((c) => stepDone(c.id))}>All {meta.questions.length} lifestyle questions answered</CheckItem>
                  <CheckItem ok={!!user.photos?.length} tip="No photo yet. A clear photo makes your profile easier to trust.">
                    {user.photos?.length} photo{user.photos?.length > 1 ? 's' : ''}
                  </CheckItem>
                  <CheckItem ok={!!form.bio.trim()} tip="Add a short bio so people have something to reply to">Bio written</CheckItem>
                  <CheckItem ok={form.interests.length >= 3} tip="Add at least 3 interests to find common ground">{form.interests.length} interests</CheckItem>
                </ul>
                <p className="muted small">
                  {dealbreakers.length ? `Dealbreakers: ${dealbreakers.map((q) => q.short.toLowerCase()).join(', ')}.` : "No dealbreakers, so you'll see the most people."}
                </p>
              </div>
            </div>
          )}

          {error && <p className="error-box" role="alert">{error}</p>}

          <footer className="ob2-actions">
            <button type="button" className="btn btn-ghost" disabled={step === 0} onClick={() => goTo(step - 1)}>
              <Icon name="back" size={18} /> Back
            </button>
            <div className="row gap">
              {editing && !isLast && (
                <button type="button" className="btn btn-ghost" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
              )}
              <button type="button" className="btn btn-primary" disabled={busy} onClick={next}>
                {isLast ? (busy ? 'Saving…' : editing ? 'Save changes' : 'Find roommates') : <>Continue <Icon name="chevron" size={18} /></>}
              </button>
            </div>
          </footer>
        </section>
      </div>
    </div>
  );
}
