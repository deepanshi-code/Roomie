/**
 * A real app screenshot inside a phone frame. Screenshots live in /public/screens as
 * <name>-light.webp and <name>-dark.webp; CSS shows the one that matches the current theme.
 * (Regenerate them with the capture script described in the README.)
 */
export default function PhoneShot({ name, alt, className = '', eager = false }) {
  const loading = eager ? 'eager' : 'lazy';
  return (
    <figure className={`phone ${className}`}>
      <span className="phone-notch" aria-hidden />
      <img className="shot shot-light" src={`/screens/${name}-light.webp`} alt={alt} loading={loading} width="390" height="844" />
      <img className="shot shot-dark" src={`/screens/${name}-dark.webp`} alt="" aria-hidden loading={loading} width="390" height="844" />
    </figure>
  );
}
