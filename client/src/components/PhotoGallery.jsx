import { useState } from 'react';

/** Tap the left/right side of the photo to move between photos (like stories). */
export default function PhotoGallery({ photos, name }) {
  const [i, setI] = useState(0);
  if (!photos?.length) return null;
  const idx = Math.min(i, photos.length - 1);
  const go = (d) => setI((idx + d + photos.length) % photos.length);

  return (
    <div className="gallery">
      <img src={photos[idx].url} alt={`${name}, photo ${idx + 1} of ${photos.length}`} draggable={false} />
      {photos.length > 1 && (
        <>
          <button type="button" className="gallery-nav prev" onClick={() => go(-1)} aria-label="Previous photo" />
          <button type="button" className="gallery-nav next" onClick={() => go(1)} aria-label="Next photo" />
          <div className="gallery-dots">
            {photos.map((p, n) => <span key={p.id} className={n === idx ? 'on' : ''} />)}
          </div>
        </>
      )}
    </div>
  );
}
