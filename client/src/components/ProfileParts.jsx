import { formatDate, formatINR, genderLabel, labelFor } from '../utils.js';
import Avatar from './Avatar.jsx';
import Icon from './Icon.jsx';
import PhotoGallery from './PhotoGallery.jsx';

/** Portrait photo frame (4:5). Falls back to a quiet initials tile when there are no photos. */
export function PhotoFrame({ user, gallery = false }) {
  const photos = user.photos ?? [];
  return (
    <div className="pf-photo">
      {photos.length === 0 && (
        <div className="pf-photo-empty"><Avatar name={user.name} size={112} /></div>
      )}
      {photos.length > 0 && gallery && <PhotoGallery photos={photos} name={user.name} />}
      {photos.length > 0 && !gallery && <img src={photos[0].url} alt={`${user.name}'s main photo`} />}
    </div>
  );
}

/** Two-column list of the practical facts a roommate needs. */
export function Basics({ user, meta, includePreference = false }) {
  const own = includePreference; // only your own profile passes this
  const gender = genderLabel(meta, user.gender) ?? (user.gender === 'prefer_not' ? 'Prefer not to say' : null);
  const rows = [
    ...(gender || own ? [['user', 'Gender', own && user.showGender === false ? `${gender ?? '—'} (hidden)` : gender ?? '—']] : []),
    ['calendar', 'Age', user.age ?? '—'],
    ['laptop', 'Occupation', user.occupation || '—'],
    ['pin', 'Area', [user.area, user.city].filter(Boolean).join(', ') || '—'],
    ['wallet', 'Budget / month', `${formatINR(user.budgetMin)} – ${formatINR(user.budgetMax)}`],
    ['door', 'Move-in', formatDate(user.moveIn)],
    ['key', 'Housing', labelFor(meta?.housing, user.housing)],
  ];
  if (includePreference) rows.push(['users', 'Roommate preference', labelFor(meta?.genderPrefs, user.genderPref)]);
  return (
    <dl className="pf-basics">
      {rows.map(([icon, label, value]) => (
        <div key={label}>
          <dt><Icon name={icon} size={16} />{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Section card with a plain heading and an optional action on the right. */
export function PfSection({ id, title, subtitle, action, children }) {
  return (
    <section className="card pf-section" id={id}>
      <header className="pf-section-head">
        <div>
          <h2>{title}</h2>
          {subtitle && <p className="muted small">{subtitle}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

/** One-line identity: "Female · B.Tech student". Your own hidden gender is left out, as others see it. */
export function identityLine(user, meta) {
  const gender = user.showGender === false ? null : genderLabel(meta, user.gender);
  return [gender, user.occupation].filter(Boolean).join(' · ');
}
