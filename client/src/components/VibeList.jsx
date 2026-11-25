import Icon from './Icon.jsx';

/** Row of lifestyle tags, e.g. [moon] Night owl  [brush] Tidy. */
export default function VibeList({ tags }) {
  if (!tags?.length) return null;
  return (
    <div className="vibes">
      {tags.map((t) => (
        <span key={t.label} className="vibe"><Icon name={t.icon} size={14} strokeWidth={2.2} />{t.label}</span>
      ))}
    </div>
  );
}
