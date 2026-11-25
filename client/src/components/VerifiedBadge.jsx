import Icon from './Icon.jsx';

/** "✓ Verified student · geu.ac.in". The domain is shown so people can judge it themselves. */
export default function VerifiedBadge({ verified, compact = false }) {
  if (!verified) return null;
  const label = verified.type === 'student' ? 'Verified student' : 'Verified work email';
  const title = `${label}: confirmed access to an email at ${verified.org}`;
  return (
    <span className={`verified-badge${compact ? ' compact' : ''}`} title={title}>
      <span className="vb-check"><Icon name="check" size={compact ? 14 : 12} strokeWidth={3.5} /></span>
      {compact ? <span className="sr-only">{title}</span> : <>{label} <span className="verified-org">· {verified.org}</span></>}
    </span>
  );
}
