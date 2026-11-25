import { initials, nameGradient } from '../vibes.js';

/** Main photo if there is one, otherwise initials on a gradient picked from the name. */
export default function Avatar({ name = '?', photo, size = 48 }) {
  const style = { width: size, height: size, fontSize: size * 0.38 };
  if (photo) return <img className="avatar avatar-img" src={photo} alt="" style={style} loading="lazy" />;
  return (
    <span className="avatar" style={{ ...style, background: nameGradient(name) }} aria-hidden>
      {initials(name)}
    </span>
  );
}
