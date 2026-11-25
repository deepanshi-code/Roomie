import { scoreTone } from '../utils.js';

export default function ScoreRing({ score, size = 72, label = 'match' }) {
  const stroke = Math.max(5, size / 12);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className={`score-ring tone-${scoreTone(score)}`} style={{ width: size, height: size }} title={`${score}% compatible`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} className="ring-track" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={r} className="ring-value" strokeWidth={stroke} fill="none"
          strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="ring-text">
        <strong style={{ fontSize: size * 0.26 }}>{score}%</strong>
        {size >= 64 && <span>{label}</span>}
      </div>
    </div>
  );
}
