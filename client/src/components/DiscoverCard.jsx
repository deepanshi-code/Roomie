import { genderLabel } from '../utils.js';
import { useAuth } from '../context/AuthContext.jsx';
import { initials, nameGradient, valuesFromBreakdown, vibeTags } from '../vibes.js';
import Icon from './Icon.jsx';
import PhotoGallery from './PhotoGallery.jsx';
import ScoreRing from './ScoreRing.jsx';
import VerifiedBadge from './VerifiedBadge.jsx';
import VibeList from './VibeList.jsx';

/**
 * The swipeable card on Discover: one big picture (photo or initials) with the essentials laid
 * over it. All the detail lives in <MatchDetails> next to it, so nothing scrolls inside the card.
 */
export default function DiscoverCard({ user, compatibility: c, stamps = null }) {
  const { meta } = useAuth();
  const vibes = vibeTags(valuesFromBreakdown(c.breakdown, meta), 4);

  return (
    <article className="dv-hero">
      {user.photos?.length ? (
        <PhotoGallery photos={user.photos} name={user.name} />
      ) : (
        <div className="pc-hero-bg" style={{ background: nameGradient(user.name) }} aria-hidden>
          <span className="pc-initials">{initials(user.name)}</span>
        </div>
      )}
      {stamps}
      <div className="score-pill" title={`${c.score}% compatible`}>
        <ScoreRing score={c.score} size={42} />
        <small>match<br />score</small>
      </div>
      <div className="dv-overlay">
        <h2>{user.name.split(' ')[0]} <span className="age">{user.age}</span> <VerifiedBadge verified={user.verified} compact /></h2>
        <div className="pc-sub">
          {genderLabel(meta, user.gender) && <span>{genderLabel(meta, user.gender)}</span>}
          {user.occupation && <span><Icon name="user" size={15} />{user.occupation}</span>}
          <span><Icon name="pin" size={15} />{[user.area, user.city].filter(Boolean).join(', ')}</span>
        </div>
        <VibeList tags={vibes} />
      </div>
    </article>
  );
}
