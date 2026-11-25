import Icon from './Icon.jsx';

/**
 * A real desktop screenshot of the website inside a browser-window frame.
 * Files: /public/screens/<name>-desktop-light.webp and -dark.webp (CSS shows the one matching the theme).
 */
export default function BrowserShot({ name, title, path = '', alt, className = '', eager = false }) {
  const loading = eager ? 'eager' : 'lazy';
  return (
    <figure className={`browser ${className}`}>
      <div className="browser-bar" aria-hidden>
        <span className="browser-dots"><i /><i /><i /></span>
        <span className="browser-tab"><span className="browser-favicon"><Icon name="home" size={10} strokeWidth={3} /></span>{title}</span>
        <span className="browser-url"><Icon name="lock" size={11} strokeWidth={2.5} />roomie{path}</span>
      </div>
      <div className="browser-view">
        <img className="shot shot-light" src={`/screens/${name}-desktop-light.webp`} alt={alt} loading={loading} width="1280" height="800" />
        <img className="shot shot-dark" src={`/screens/${name}-desktop-dark.webp`} alt="" aria-hidden loading={loading} width="1280" height="800" />
      </div>
    </figure>
  );
}
