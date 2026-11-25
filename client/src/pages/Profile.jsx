import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { THEMES, useTheme } from '../context/ThemeContext.jsx';
import Icon from '../components/Icon.jsx';
import PhotoManager from '../components/PhotoManager.jsx';
import { Basics, PfSection, PhotoFrame, identityLine } from '../components/ProfileParts.jsx';
import VerifiedBadge from '../components/VerifiedBadge.jsx';
import VerifyEmail from '../components/VerifyEmail.jsx';
import VibeList from '../components/VibeList.jsx';
import { CATEGORY_ICON, valuesFromAnswers, vibeTags } from '../vibes.js';

const NAV = [
  ['about', 'About you'],
  ['photos', 'Photos'],
  ['lifestyle', 'Lifestyle'],
  ['verify', 'Verification'],
  ['settings', 'Settings'],
];

/** What makes a profile useful to others, and what's still missing. */
function profileChecklist(user, meta) {
  const answered = meta.questions.filter((q) => user.answers?.[q.id]).length;
  return [
    { done: (user.photos?.length ?? 0) > 0, label: 'Add a clear photo of your face', to: '#photos' },
    { done: (user.bio ?? '').trim().length >= 20, label: 'Write a short bio', to: '/profile/edit' },
    { done: (user.interests?.length ?? 0) >= 3, label: 'Add at least 3 interests', to: '/profile/edit' },
    { done: answered === meta.questions.length, label: `Answer all lifestyle questions (${answered}/${meta.questions.length})`, to: '/profile/edit' },
    { done: Boolean(user.verified), label: 'Verify a college or work email', to: '#verify' },
  ];
}

export default function Profile() {
  const { user, setUser, meta, logout } = useAuth();
  const [savingGender, setSavingGender] = useState(false);
  const [genderError, setGenderError] = useState('');

  async function toggleShowGender(e) {
    const showGender = e.target.checked;
    setSavingGender(true);
    setGenderError('');
    try {
      const r = await api('/me', { method: 'PUT', body: { showGender } });
      setUser(r.user);
    } catch (err) {
      setGenderError(err.message);
    } finally {
      setSavingGender(false);
    }
  }
  const { theme, setTheme } = useTheme();
  const { hash } = useLocation();
  const navigate = useNavigate();
  const vibes = vibeTags(valuesFromAnswers(user.answers), 8);
  const checklist = profileChecklist(user, meta);
  const done = checklist.filter((c) => c.done).length;
  const pct = Math.round((done / checklist.length) * 100);
  const next = checklist.find((c) => !c.done);

  // Links like /profile#verify jump to that section.
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [hash]);

  return (
    <div className="pf">
      <aside className="pf-side">
        <div className="card pf-id">
          <PhotoFrame user={user} />
          <div className="pf-name">
            <h1>{user.name}{user.age ? <span className="pf-age">, {user.age}</span> : null}</h1>
            <VerifiedBadge verified={user.verified} compact />
          </div>
          <p className="pf-identity">{identityLine(user, meta) || 'Add your details'}</p>
          <p className="pf-place"><Icon name="pin" size={15} />{[user.area, user.city].filter(Boolean).join(', ')}</p>

          <div className="pf-strength" aria-label={`Profile ${pct}% complete`}>
            <div className="pf-strength-top"><b>Profile strength</b><span>{pct}%</span></div>
            <div className="pf-meter"><span style={{ width: `${pct}%` }} /></div>
            {next
              ? (next.to.startsWith('#')
                ? <a href={next.to} className="pf-next">Next: {next.label}<Icon name="chevron" size={14} /></a>
                : <Link to={next.to} className="pf-next">Next: {next.label}<Icon name="chevron" size={14} /></Link>)
              : <p className="pf-next done"><Icon name="check" size={14} />Your profile is complete</p>}
          </div>

          <Link to="/profile/edit" className="btn btn-primary pf-edit"><Icon name="edit" size={17} />Edit profile</Link>
        </div>

        <nav className="card pf-nav" aria-label="Profile sections">
          {NAV.map(([id, label]) => <a key={id} href={`#${id}`}>{label}<Icon name="chevron" size={14} /></a>)}
        </nav>
      </aside>

      <div className="pf-main">
        <PfSection id="about" title="About you" subtitle="What people see before they decide to match." action={<Link to="/profile/edit" className="pf-action">Edit</Link>}>
          <Basics user={user} meta={meta} includePreference />
          {user.gender && user.gender !== 'prefer_not' && (
            <div className="pf-privacy">
              <div>
                <b>Show my gender on my profile</b>
                <p className="muted small">
                  {user.showGender
                    ? 'Others see it on your card, profile and in chat.'
                    : 'Hidden from others. It is still used for matching if you or they choose "same gender only".'}
                </p>
                {genderError && <p className="error-box">{genderError}</p>}
              </div>
              <label className="toggle">
                <input type="checkbox" checked={user.showGender} disabled={savingGender} onChange={toggleShowGender} aria-label="Show my gender on my profile" />
              </label>
            </div>
          )}
          <div className="pf-block">
            <h3>Bio</h3>
            {user.bio ? <p className="pf-bio">{user.bio}</p> : <p className="muted">No bio yet. A few lines about your routine help people decide.</p>}
          </div>
          {user.interests.length > 0 && (
            <div className="pf-block">
              <h3>Interests</h3>
              <div className="pf-tags">{user.interests.map((i) => <span key={i} className="pf-tag">{i}</span>)}</div>
            </div>
          )}
        </PfSection>

        <PfSection id="photos" title="Photos" subtitle="Your first photo is the one people see first. Up to 6.">
          <PhotoManager />
        </PfSection>

        <PfSection
          id="lifestyle" title="Lifestyle"
          subtitle="Others see your answers. How much each one matters to you, and your dealbreakers, stay private."
          action={<Link to="/profile/edit" className="pf-action">Edit answers</Link>}
        >
          {vibes.length > 0 && <div className="pf-block"><h3>At a glance</h3><VibeList tags={vibes} /></div>}
          <div className="pf-answers">
            {meta.categories.map((cat) => (
              <div key={cat.id} className="pf-answer-group">
                <h3><Icon name={CATEGORY_ICON[cat.id]} size={16} />{cat.label}</h3>
                <dl>
                  {meta.questions.filter((q) => q.category === cat.id).map((q) => {
                    const a = user.answers[q.id];
                    return (
                      <div key={q.id}>
                        <dt>{q.short}</dt>
                        <dd>
                          <span>{a ? q.options[a.value] : '—'}</span>
                          {a && (
                            <small className={a.dealbreaker ? 'pf-deal' : ''}>
                              {a.dealbreaker ? 'Dealbreaker' : meta.importanceLabels[a.importance]}
                            </small>
                          )}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              </div>
            ))}
          </div>
        </PfSection>

        <PfSection id="verify" title="Verification" subtitle="A badge shows people you're a real student or professional.">
          <VerifyEmail />
        </PfSection>

        <PfSection id="settings" title="Settings">
          <div className="pf-setting">
            <div>
              <b>Appearance</b>
              <p className="muted small">Only changes how the app looks for you.</p>
            </div>
            <div className="theme-grid pf-themes" role="radiogroup" aria-label="Theme">
              {THEMES.map((t) => (
                <button
                  key={t.id} type="button" role="radio" aria-checked={theme === t.id}
                  className={`theme-opt${theme === t.id ? ' on' : ''}`} onClick={() => setTheme(t.id)}
                >
                  <span className="theme-swatch" style={{ background: `linear-gradient(135deg, ${t.swatch[0]}, ${t.swatch[1]})` }}>
                    <span style={{ background: t.swatch[2] }} />
                  </span>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="pf-setting row-setting">
            <div>
              <b>App tour</b>
              <p className="muted small">Walk through Discover again, step by step.</p>
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('/discover', { state: { tour: true } })}>Show tour</button>
          </div>
          <div className="pf-setting row-setting">
            <div>
              <b>Log out</b>
              <p className="muted small">You can log back in any time with your email.</p>
            </div>
            <button type="button" className="btn btn-ghost btn-sm pf-logout" onClick={logout}><Icon name="logout" size={16} />Log out</button>
          </div>
        </PfSection>
      </div>
    </div>
  );
}
