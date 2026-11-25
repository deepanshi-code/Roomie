import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';

const PAD = 8; // space around the highlighted element
const GAP = 14; // space between highlight and tooltip

/**
 * Guided tour ("coach marks"): dims the page, spotlights one real element at a time and explains
 * what it does. steps: [{ target: CSS selector, title, text }]. Steps whose target isn't on the
 * page, or is hidden (e.g. desktop-only links on a phone), are skipped automatically.
 */
const isVisible = (sel) => {
  const el = document.querySelector(sel);
  return !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
};

export default function Tour({ steps, onClose }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState(null);
  const [tipPos, setTipPos] = useState(null);
  const tipRef = useRef(null);
  // Decided once when the tour opens, so the numbering can't shift halfway through.
  const [available] = useState(() => steps.filter((s) => isVisible(s.target)));
  const step = available[i];
  const isLast = i === available.length - 1;

  const measure = useCallback(() => {
    const el = step && document.querySelector(step.target);
    if (!el) { setRect(null); return; }
    const r = el.getBoundingClientRect();
    setRect({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 });
  }, [step]);

  // Bring the target into view, then measure it.
  useEffect(() => {
    const el = step && document.querySelector(step.target);
    if (!el) return undefined;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const t = setTimeout(measure, 350);
    measure();
    return () => clearTimeout(t);
  }, [step, measure]);

  useEffect(() => {
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => { window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true); };
  }, [measure]);

  // Place the tooltip below the highlight if it fits, otherwise above; keep it on screen.
  useLayoutEffect(() => {
    if (!rect || !tipRef.current) return;
    const tip = tipRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let top = rect.top + rect.height + GAP;
    let placement = 'below';
    if (top + tip.height > vh - 12) { top = rect.top - tip.height - GAP; placement = 'above'; }
    let left = Math.max(12, Math.min(vw - tip.width - 12, rect.left + rect.width / 2 - tip.width / 2));
    if (top < 12) {
      // No room above or below (tall target): put the tooltip beside the visible part of it,
      // so it doesn't cover what it's describing. Only if nothing fits does it go on top.
      const visTop = Math.max(rect.top, 0);
      const visBottom = Math.min(rect.top + rect.height, vh);
      top = Math.max(12, Math.min(vh - tip.height - 12, (visTop + visBottom) / 2 - tip.height / 2));
      if (rect.left + rect.width + GAP + tip.width <= vw - 12) { left = rect.left + rect.width + GAP; placement = 'right'; }
      else if (rect.left - GAP - tip.width >= 12) { left = rect.left - GAP - tip.width; placement = 'left'; }
      else placement = 'over';
    }
    const arrowLeft = Math.max(18, Math.min(tip.width - 18, rect.left + rect.width / 2 - left));
    setTipPos({ top, left, placement, arrowLeft });
  }, [rect, i]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); isLast ? onClose() : setI((n) => n + 1); }
      if (e.key === 'ArrowLeft') setI((n) => Math.max(0, n - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isLast, onClose]);

  if (!step) return null;

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      {/* Clicks on the dimmed area do nothing, so people don't trigger actions by accident. */}
      <div className="tour-blocker" />
      {rect && <div className="tour-spot" style={rect} />}
      <div
        ref={tipRef}
        className={`tour-tip ${tipPos?.placement ?? 'below'}`}
        style={tipPos ? { top: tipPos.top, left: tipPos.left, '--arrow-left': `${tipPos.arrowLeft}px` } : { visibility: 'hidden' }}
        key={i}
      >
        <div className="tour-head">
          <span className="tour-count">{i + 1} of {available.length}</span>
          <button type="button" className="tour-skip" onClick={onClose}>Skip tour</button>
        </div>
        <h3 id="tour-title">{step.title}</h3>
        <p>{step.text}</p>
        <div className="tour-actions">
          <div className="tour-dots" aria-hidden>
            {available.map((s, n) => <span key={s.target} className={n === i ? 'on' : ''} />)}
          </div>
          <div className="row gap">
            {i > 0 && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setI(i - 1)}><Icon name="back" size={16} /> Back</button>}
            <button type="button" className="btn btn-primary btn-sm" onClick={() => (isLast ? onClose() : setI(i + 1))} autoFocus>
              {isLast ? 'Got it' : <>Next <Icon name="chevron" size={16} /></>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
