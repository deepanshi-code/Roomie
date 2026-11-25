import { useEffect, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';

/**
 * Intro carousel shown to logged-out visitors, like the first-run screens in most apps.
 * Swipe (or drag, use the arrow keys, tap the dots or "Next") through:
 *   hello → नमस्ते → how swiping works → matching & chat → house rules → get started
 */
const SLIDES = [
  { kind: 'hello', text: 'hello', lang: 'en', font: 'script', label: 'Hello' },
  { kind: 'hello', text: 'नमस्ते', lang: 'hi', font: 'kalam', label: 'Namaste, hello in Hindi' },
  {
    kind: 'info', art: 'swipe', title: 'Swipe to find your roommate',
    text: 'Each card is a person near you. Swipe right (or tap the thumbs-up) if you could live with them, left to pass.',
  },
  {
    kind: 'info', art: 'match', title: 'Match, then chat',
    text: "When you both swipe right, it's a match. Only then can you message each other, so no strangers in your inbox.",
  },
  {
    kind: 'info', art: 'rules', title: 'Agree on house rules',
    text: 'Before moving in, Roomie drafts simple house rules from both your answers. Edit them together and agree.',
  },
  { kind: 'start', title: 'Ready to find your roommate?', text: 'It takes about 3 minutes to set up.' },
];
const SWIPE_PX = 50;

function SwipeArt() {
  return (
    <div className="art art-swipe" aria-hidden>
      <div className="art-card back" />
      <div className="art-card front">
        <div className="art-hero"><span>AR</span><b className="art-stamp">LIKE</b></div>
        <div className="art-lines"><i /><i /><i className="short" /></div>
      </div>
      <span className="art-btn pass"><Icon name="x" size={20} strokeWidth={3} /></span>
      <span className="art-btn like"><Icon name="thumb" size={22} /></span>
      <span className="art-hand"><Icon name="chevron" size={26} strokeWidth={3} /></span>
    </div>
  );
}

function MatchArt() {
  return (
    <div className="art art-match" aria-hidden>
      <div className="art-avatars">
        <span className="a1">AR</span>
        <span className="art-heart"><Icon name="key" size={20} /></span>
        <span className="a2">KM</span>
      </div>
      <div className="art-bubble left">Hi! Still looking near campus?</div>
      <div className="art-bubble right">Yes! Coffee this weekend?</div>
    </div>
  );
}

function RulesArt() {
  return (
    <div className="art art-rules" aria-hidden>
      <div className="art-doc">
        {['Quiet hours 11 pm – 8 am', 'Dishes done the same day', 'Guests with a heads-up', 'Bills split monthly'].map((r, n) => (
          <div key={r} className="art-rule" style={{ animationDelay: `${0.25 + n * 0.18}s` }}>
            <span><Icon name="check" size={14} strokeWidth={3.2} /></span>{r}
          </div>
        ))}
        <div className="art-sign"><span>AR ✓</span><span>KM ✓</span></div>
      </div>
    </div>
  );
}

const ART = { swipe: SwipeArt, match: MatchArt, rules: RulesArt };

export default function Welcome({ onDone }) {
  const [index, setIndex] = useState(0);
  const [drag, setDrag] = useState(0);
  const start = useRef(null);
  const last = SLIDES.length - 1;

  const go = (n) => setIndex(Math.max(0, Math.min(last, n)));

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight') go(index + 1);
      if (e.key === 'ArrowLeft') go(index - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function onPointerDown(e) {
    if (e.target.closest('button, a')) return;
    start.current = e.clientX;
    const move = (ev) => setDrag(ev.clientX - start.current);
    const up = (ev) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      const dx = ev.clientX - start.current;
      if (dx < -SWIPE_PX) go(index + 1);
      else if (dx > SWIPE_PX) go(index - 1);
      setDrag(0);
      start.current = null;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  // Rubber-band at the ends so it feels like a real carousel.
  const resist = (index === 0 && drag > 0) || (index === last && drag < 0) ? 0.3 : 1;

  return (
    <div className="welcome intro" onPointerDown={onPointerDown}>
      <div className="welcome-blobs" aria-hidden><span /><span /><span /></div>

      <div className="intro-top">
        <span className="intro-brand"><span className="brand-mark"><Icon name="home" size={18} /></span>Roomie</span>
        {index < last && <button type="button" className="welcome-skip" onClick={() => go(last)}>Skip</button>}
      </div>

      <div className="intro-viewport">
        <div
          className={`intro-track${drag ? ' dragging' : ''}`}
          style={{ transform: `translateX(calc(${-index * 100}% + ${drag * resist}px))` }}
        >
          {SLIDES.map((s, n) => {
            const Art = ART[s.art];
            return (
              <section key={s.title ?? s.text} className={`intro-slide${n === index ? ' active' : ''}`} aria-hidden={n !== index}>
                {s.kind === 'hello' && (
                  <svg key={n === index ? `on-${n}` : `off-${n}`} className={`hello-svg still font-${s.font}`} viewBox="0 0 1000 300" role="img" aria-label={s.label}>
                    <text x="50%" y="56%" textAnchor="middle" dominantBaseline="middle" lang={s.lang} className="hello-text">{s.text}</text>
                  </svg>
                )}
                {s.kind === 'info' && (
                  <div className="intro-info">
                    <Art />
                    <h2>{s.title}</h2>
                    <p>{s.text}</p>
                  </div>
                )}
                {s.kind === 'start' && (
                  <div className="intro-info intro-start">
                    <span className="intro-start-icon"><Icon name="home" size={34} /></span>
                    <h2>{s.title}</h2>
                    <p>{s.text}</p>
                    <div className="ws-actions">
                      <button type="button" className="btn btn-lg welcome-btn" onClick={() => onDone('register')} tabIndex={n === index ? 0 : -1}>
                        Create my account <Icon name="chevron" size={18} />
                      </button>
                      <button type="button" className="ws-link" onClick={() => onDone('login')} tabIndex={n === index ? 0 : -1}>I already have an account</button>
                      <button type="button" className="ws-link subtle" onClick={() => onDone(null)} tabIndex={n === index ? 0 : -1}>Just look around first</button>
                    </div>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </div>

      <div className="intro-bottom">
        <button type="button" className="intro-arrow" onClick={() => go(index - 1)} disabled={index === 0} aria-label="Previous">
          <Icon name="back" size={20} />
        </button>
        <div className="intro-dots" role="tablist" aria-label="Intro slides">
          {SLIDES.map((s, n) => (
            <button key={n} type="button" role="tab" aria-selected={n === index} aria-label={`Slide ${n + 1}`}
              className={n === index ? 'on' : ''} onClick={() => go(n)} />
          ))}
        </div>
        {index < last ? (
          <button type="button" className="intro-next" onClick={() => go(index + 1)}>
            Next <Icon name="chevron" size={18} />
          </button>
        ) : <span className="intro-next-spacer" />}
      </div>
      {index === 0 && <p className="intro-hint" aria-hidden>Swipe to continue</p>}
    </div>
  );
}
