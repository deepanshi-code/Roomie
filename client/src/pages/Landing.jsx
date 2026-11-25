import { useEffect, useState } from 'react';
import AuthModal from '../components/AuthModal.jsx';
import Icon from '../components/Icon.jsx';
import BrowserShot from '../components/BrowserShot.jsx';
import PhoneShot from '../components/PhoneShot.jsx';
import Tour from '../components/Tour.jsx';
import TryIt from '../components/TryIt.jsx';
import { useTheme } from '../context/ThemeContext.jsx';

const LANDING_TOUR_KEY = 'roomie_landing_tour_seen';

/** Step-by-step guide to the front page: where to click, and why. */
const LANDING_TOUR = [
  { target: '.land-join', title: 'Start here: create your free account', text: 'Sign up with your name and email, then answer 16 quick lifestyle questions. It takes about 3 minutes.' },
  { target: '.land-cta .btn-ghost', title: 'Already have an account?', text: 'Log in here to see your matches, chats and house rules.' },
  { target: '.land-links', title: 'Jump around the page', text: 'Try it, How it works, Screens, Features and FAQ. Each link scrolls to that part of this page.' },
  { target: '#try .try-questions', title: 'Try it without signing up', text: 'Tap one answer for each of these 4 habits. This is how Roomie learns how you live.' },
  { target: '#try .try-deck', title: 'Real people near you', text: 'Each card is someone looking for a roommate. The % shows how well your habits match. You only see first names until you join.' },
  { target: '#try .try-cities', title: 'Change the city', text: 'Looking somewhere else? Pick another city to see people there.' },
  { target: '#try .btn-round.like', title: 'Like someone you could live with', text: "We'll ask you to sign up first, so they can see your like. If they like you back, you can chat." },
  { target: '#try .btn-round.pass', title: 'Not a fit? Pass', text: "Nobody is told. You'll simply see the next person." },
  { target: '#how .step-row', title: 'What happens after you sign up', text: 'Four steps, shown with real screens: questions, swiping, chatting, and agreeing on house rules.' },
  { target: '.land-cta .icon-btn', title: 'Light or dark', text: 'Switch the look whenever you like. You can pick from more themes after you join.' },
  { target: '#faq .faq', title: 'Still have questions?', text: 'Cost, privacy, verification and who can message you are all answered here.' },
  { target: '.land-final-btn', title: "Ready when you are", text: "Create your account and see who you'd actually get along with." },
];

const PROBLEMS = [
  { icon: 'moon', title: 'Different body clocks', text: 'One sleeps at 10, the other games until 3.' },
  { icon: 'utensils', title: 'The sink of doom', text: '"I\'ll do them tomorrow" becomes a weekly fight.' },
  { icon: 'users', title: 'Surprise guests', text: 'Friends over every night when you need quiet.' },
  { icon: 'wallet', title: 'Who paid for what?', text: 'Wi-Fi, groceries, the maid: nobody tracked it.' },
];

const STEPS = [
  { icon: 'doc', shot: 'onboarding', title: 'Answer 16 quick questions', text: 'Sleep, cleanliness, guests, food and money, one tap per answer. About 3 minutes. You also choose how much each one matters and what\'s a dealbreaker.' },
  { icon: 'target', shot: 'discover', title: 'Swipe on real compatibility', text: 'People near you are ranked by how well your lifestyles fit. Swipe right or tap the thumbs-up if you could live with them, left to pass.' },
  { icon: 'chat', shot: 'chat', title: 'Chat after a mutual like', text: 'Nobody can message you unless you both said yes. Icebreakers, meet-up safety tips and "things to talk about" are built into every chat.' },
  { icon: 'check', shot: 'agreement', title: 'Agree on house rules', text: 'Roomie drafts quiet hours, chores, guests and bills from both your answers. Edit them together, then both tap "I agree".' },
];

const PAGES = {
  discover: { title: 'Discover', path: '/discover' },
  compare: { title: 'Kabir · Comparison', path: '/users/kabir' },
  match: { title: 'You both said yes', path: '/users/kabir' },
  chat: { title: 'Chat with Ishita', path: '/chat' },
  agreement: { title: 'House rules', path: '/agreement' },
  onboarding: { title: 'Edit profile', path: '/profile/edit' },
  profile: { title: 'Your profile', path: '/profile' },
};

const GALLERY = [
  { name: 'discover', title: 'Discover', text: 'Swipe through people ranked by compatibility.' },
  { name: 'compare', title: 'Full comparison', text: 'Every answer side by side, with ✓ same and ≠ different.' },
  { name: 'match', title: 'You both said yes', text: 'When you both like each other, chat opens up.' },
  { name: 'chat', title: 'Chat', text: 'Icebreakers, safety tips and real-time messages.' },
  { name: 'agreement', title: 'House rules', text: 'An agreement drafted from both your answers.' },
  { name: 'onboarding', title: 'Lifestyle questions', text: 'One tap per answer, about 3 minutes in total.' },
  { name: 'profile', title: 'Your profile', text: 'Photos, verified badge, lifestyle tags and themes.' },
];

const FEATURES = [
  { icon: 'chart', title: 'Scores you can actually read', text: 'See exactly where you match ("same bedtime") and what to talk about first ("guests").' },
  { icon: 'shield', title: 'Verified badges', text: 'Students and professionals can verify a college or work email. The address itself stays private.' },
  { icon: 'doc', title: 'Roommate agreement', text: 'Quiet hours, chores, guests and bills, drafted from both your answers. Edit it together and agree.' },
  { icon: 'lock', title: 'Safety built in', text: 'Mutual-like chat, one-tap block, and meet-up tips. Your dealbreakers are never shown to anyone.' },
  { icon: 'camera', title: 'Photos, minus the location', text: 'Photos are resized in your browser and their hidden GPS data is removed before upload.' },
  { icon: 'palette', title: 'Make it yours', text: 'Five themes, from Sunset to Neon, plus one that follows your device.' },
];

const QUIZ = {
  question: 'Your dishes have been in the sink since lunch. You…',
  options: [
    { label: 'Already washed them', type: 'The Spotless One', text: 'We\'d put people who clean as they go at the top, and flag anyone who leaves dishes for days.' },
    { label: 'Wash them by night', type: 'The Reasonable One', text: 'You\'d match well with most people. We\'d just warn you about the "someday" washers.' },
    { label: 'Get to them in a day or two', type: 'The Relaxed One', text: 'We\'d steer you away from neat freaks, and suggest a chore rota in your agreement.' },
    { label: 'Wait until someone says something', type: 'The Chill One', text: 'Honesty wins! We\'d find someone just as relaxed, so nobody is secretly furious.' },
  ],
};

const FAQ = [
  { q: 'Is Roomie free?', a: 'Yes, everything is free to use right now.' },
  { q: 'How is my match score calculated?', a: 'From your 16 lifestyle answers and how much each one matters to you. It works both ways: someone only ranks high if they fit what you care about and you fit what they care about. Shared interests add a little extra. Every score comes with the reasons behind it.' },
  { q: 'Who can see my information?', a: 'Other people see your profile, photos and lifestyle answers. Your email address, how much each answer matters to you, and your dealbreakers are never shown to anyone.' },
  { q: 'Can strangers message me?', a: 'No. Chat only opens when you both like each other, and you can unmatch or block anyone at any time.' },
  { q: 'What does the verified badge mean?', a: 'That the person confirmed they can read mail at a college or work email domain. It shows the domain (like geu.ac.in) so you can judge it yourself. It doesn\'t prove they still study or work there.' },
  { q: 'Is it only for students?', a: 'No. Anyone looking for a roommate can join, whether you have a place and need someone, or want to find a place together.' },
];

/** Adds .in to elements with .reveal when they scroll into view. */
function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) { els.forEach((el) => el.classList.add('in')); return undefined; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.15 });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

function Quiz({ onJoin }) {
  const [pick, setPick] = useState(null);
  const result = pick !== null ? QUIZ.options[pick] : null;
  return (
    <div className="quiz card reveal">
      <p className="eyebrow grad-text">Try one question</p>
      <h3 className="quiz-q">{QUIZ.question}</h3>
      <div className="option-grid">
        {QUIZ.options.map((o, idx) => (
          <button key={o.label} type="button" className={`option${pick === idx ? ' selected' : ''}`} onClick={() => setPick(idx)} aria-pressed={pick === idx}>
            <span>{o.label}</span>
          </button>
        ))}
      </div>
      {result && (
        <div className="quiz-result" key={pick}>
          <span className="quiz-type">You're <b>{result.type}</b></span>
          <p>{result.text}</p>
          <button type="button" className="btn btn-primary btn-sm" onClick={onJoin}>Answer the other 15 →</button>
        </div>
      )}
    </div>
  );
}

export default function Landing({ onReplayWelcome, initialAuth = null }) {
  const [auth, setAuth] = useState(initialAuth); // 'register' | 'login' | null
  const [authNote, setAuthNote] = useState('');
  const [openFaq, setOpenFaq] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const { theme, setTheme } = useTheme();
  const [showWelcome, setShowWelcome] = useState(false);
  const [showTour, setShowTour] = useState(false);
  useReveal();

  // First visit (and not heading straight to sign-up): offer a short guided tour of this page.
  useEffect(() => {
    if (initialAuth) return undefined;
    let seen = false;
    try { seen = localStorage.getItem(LANDING_TOUR_KEY) === '1'; } catch { /* ignore */ }
    if (seen) return undefined;
    const t = setTimeout(() => setShowWelcome(true), 900);
    return () => clearTimeout(t);
  }, [initialAuth]);

  const markTourSeen = () => { try { localStorage.setItem(LANDING_TOUR_KEY, '1'); } catch { /* ignore */ } };
  const startTour = () => { setShowWelcome(false); window.scrollTo({ top: 0 }); setTimeout(() => setShowTour(true), 250); };
  const skipWelcome = () => { setShowWelcome(false); markTourSeen(); };
  const endTour = () => { setShowTour(false); markTourSeen(); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const join = () => { setAuthNote(''); setAuth('register'); };
  const joinToLike = (name) => {
    setAuthNote(name ? `Create a free account to like ${name} and see if they like you back.` : '');
    setAuth('register');
  };
  const isDark = theme === 'evening' || theme === 'midnight' || theme === 'neon'
    || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  return (
    <div className="landing">
      <header className={`land-nav${scrolled ? ' scrolled' : ''}`}>
        <a href="#top" className="brand"><span className="brand-mark"><Icon name="home" size={20} /></span><span className="grad-text">Roomie</span></a>
        <nav className="land-links" aria-label="Sections">
          <a href="#try">Try it</a>
          <a href="#how">How it works</a>
          <a href="#screens">Screens</a>
          <a href="#features">Features</a>
          <a href="#faq">FAQ</a>
        </nav>
        <div className="land-cta">
          <button type="button" className="icon-btn" onClick={() => setTheme(isDark ? 'home' : 'evening')} aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'} title="Light / dark">
            <Icon name={isDark ? 'sun' : 'moon'} size={18} />
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAuth('login')}>Log in</button>
          <button type="button" className="btn btn-primary btn-sm land-join" onClick={join}>Get started</button>
        </div>
      </header>

      <section className="land-hero" id="top">
        <div className="hero-copy fade-up">
          <span className="pill"><Icon name="home" size={15} /> Roommate matching for real life</span>
          <h1>Find a roommate you actually <span className="grad-text">vibe</span> with.</h1>
          <p className="hero-sub">
            Rent and location are the easy part. We match you on what really decides if living together works:
            sleep, cleanliness, guests, food and money.
          </p>
          <div className="row gap hero-buttons">
            <button type="button" className="btn btn-primary btn-lg" onClick={join}>Get started, it's free <Icon name="chevron" size={18} /></button>
            <a href="#try" className="btn btn-ghost btn-lg">Try it, no sign-up</a>
          </div>
          <ul className="trust-row">
            <li><Icon name="shield" size={16} /> Verified students & pros</li>
            <li><Icon name="chat" size={16} /> Chat only after a mutual like</li>
            <li><Icon name="lock" size={16} /> Dealbreakers stay private</li>
          </ul>
        </div>
        <div className="hero-visual" aria-label="Screenshots of the Roomie website">
          <BrowserShot name="discover" {...PAGES.discover} alt="The Roomie website: Discover page with a roommate card and 77% match score" eager />
          <PhoneShot name="discover" alt="Roomie on a phone" className="hero-phone" eager />
          <span className="hero-chip chip-a"><Icon name="check" size={14} /> 77% match</span>
          <span className="hero-chip chip-b"><Icon name="laptop" size={14} /> Works on laptop & phone</span>
        </div>
      </section>

      <section className="land-section" id="try">
        <div className="section-intro reveal">
          <p className="eyebrow grad-text">Try it now · no sign-up</p>
          <h2>See who you'd match with</h2>
          <p className="muted">Answer 4 quick habits, then swipe through real people looking for a roommate.</p>
        </div>
        <TryIt onJoin={joinToLike} />
      </section>

      <section className="land-section" id="problem">
        <div className="section-intro reveal">
          <p className="eyebrow grad-text">The real problem</p>
          <h2>Most roommate fights aren't about rent.</h2>
          <p className="muted">They're about the small, daily stuff nobody asks about until it's too late.</p>
        </div>
        <div className="problem-grid">
          {PROBLEMS.map((p, i) => (
            <div key={p.title} className="problem card reveal" style={{ transitionDelay: `${i * 80}ms` }}>
              <span className="icon-badge"><Icon name={p.icon} size={22} /></span>
              <h3>{p.title}</h3>
              <p className="muted small">{p.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="land-section" id="how">
        <div className="section-intro reveal">
          <p className="eyebrow grad-text">How it works</p>
          <h2>From stranger to roommate in 4 steps</h2>
        </div>
        <ol className="step-rows">
          {STEPS.map((st, i) => (
            <li key={st.title} className={`step-row reveal${i % 2 ? ' flip' : ''}`}>
              <BrowserShot name={st.shot} {...PAGES[st.shot]} alt={`${st.title}: screenshot of the Roomie website`} />
              <div className="step-copy">
                <span className="step-badge"><Icon name={st.icon} size={18} /> Step {i + 1}</span>
                <h3>{st.title}</h3>
                <p className="muted">{st.text}</p>
              </div>
            </li>
          ))}
        </ol>
        <Quiz onJoin={join} />
      </section>

      <section className="land-section" id="screens">
        <div className="section-intro reveal">
          <p className="eyebrow grad-text">See it in action</p>
          <h2>Real screens from the website</h2>
          <p className="muted">Scroll sideways to look around.</p>
        </div>
        <div className="gallery-strip">
          {GALLERY.map((g) => (
            <figure key={g.name} className="gallery-item">
              <BrowserShot name={g.name} {...PAGES[g.name]} alt={`${g.title}: screenshot of the Roomie website`} />
              <figcaption><b>{g.title}</b><span className="muted small">{g.text}</span></figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="land-section" id="features">
        <div className="section-intro reveal">
          <p className="eyebrow grad-text">Features</p>
          <h2>Everything you need to live well together</h2>
        </div>
        <div className="feature-grid">
          {FEATURES.map((f, i) => (
            <div key={f.title} className="feature card reveal" style={{ transitionDelay: `${(i % 3) * 80}ms` }}>
              <span className="feature-emoji"><Icon name={f.icon} size={24} /></span>
              <h3>{f.title}</h3>
              <p className="muted small">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="land-section" id="faq">
        <div className="section-intro reveal">
          <p className="eyebrow grad-text">FAQ</p>
          <h2>Questions, answered</h2>
        </div>
        <div className="faq reveal">
          {FAQ.map((f, i) => (
            <div key={f.q} className={`faq-item${openFaq === i ? ' open' : ''}`}>
              <button type="button" className="faq-q" onClick={() => setOpenFaq(openFaq === i ? -1 : i)} aria-expanded={openFaq === i}>
                {f.q}<span className="faq-icon" aria-hidden>+</span>
              </button>
              <div className="faq-a"><p>{f.a}</p></div>
            </div>
          ))}
        </div>
      </section>

      <section className="land-final reveal">
        <h2>Your next roommate could be one swipe away.</h2>
        <p>Answer 16 questions and see who you'd actually get along with.</p>
        <button type="button" className="btn btn-lg land-final-btn" onClick={join}>Get started, it's free <Icon name="chevron" size={18} /></button>
      </section>

      <footer className="land-footer">
        <span className="brand"><span className="brand-mark"><Icon name="home" size={18} /></span>Roomie</span>
        <nav>
          <a href="#how">How it works</a>
          <a href="#faq">FAQ</a>
          <button type="button" className="link" onClick={startTour}>Show me around</button>
          <button type="button" className="link" onClick={onReplayWelcome}>Replay the hello</button>
        </nav>
        <span className="muted small">© 2026 Roomie · Made for anyone looking for a roommate</span>
      </footer>

      {showWelcome && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
          <div className="modal welcome-card">
            <span className="icon-badge big"><Icon name="home" size={30} /></span>
            <h2 id="welcome-title">Welcome to Roomie</h2>
            <p className="muted">
              Find a roommate whose everyday habits fit yours. New here? A one-minute tour shows you where to click,
              and why.
            </p>
            <button type="button" className="btn btn-primary btn-lg btn-block" onClick={startTour} autoFocus>
              Take the quick tour <Icon name="chevron" size={18} />
            </button>
            <button type="button" className="link" onClick={skipWelcome}>Skip, I'll look around</button>
            <p className="muted small welcome-note"><Icon name="lock" size={13} /> You can try it without an account</p>
          </div>
        </div>
      )}
      {showTour && <Tour steps={LANDING_TOUR} onClose={endTour} />}
      {auth && <AuthModal initialMode={auth} note={authNote} onClose={() => { setAuth(null); setAuthNote(''); }} />}
    </div>
  );
}
