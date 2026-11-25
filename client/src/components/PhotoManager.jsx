import { useRef, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { prepareImage } from '../utils.js';

const MAX = 6;

/** Upload, remove and choose the main photo. Changes save immediately. */
export default function PhotoManager() {
  const { user, setUser } = useAuth();
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const photos = user.photos ?? [];

  const setPhotos = (p) => setUser((u) => ({ ...u, photos: p }));

  async function onPick(e) {
    const files = [...e.target.files].slice(0, MAX - photos.length);
    e.target.value = '';
    if (!files.length) return;
    setBusy(true);
    setError('');
    try {
      for (const file of files) {
        const blob = await prepareImage(file);
        const form = new FormData();
        form.append('photo', blob, 'photo.jpg');
        const r = await api('/me/photos', { method: 'POST', form });
        setPhotos(r.photos);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id) {
    setError('');
    try { setPhotos((await api(`/me/photos/${id}`, { method: 'DELETE' })).photos); } catch (err) { setError(err.message); }
  }

  async function makeMain(id) {
    setError('');
    const ids = [id, ...photos.map((p) => p.id).filter((x) => x !== id)];
    try { setPhotos((await api('/me/photos/order', { method: 'PUT', body: { ids } })).photos); } catch (err) { setError(err.message); }
  }

  return (
    <div className="photo-manager">
      <div className="photo-grid">
        {photos.map((p, i) => (
          <div key={p.id} className="photo-tile">
            <img src={p.url} alt={`Your photo ${i + 1}`} />
            {i === 0 && <span className="photo-main">Main</span>}
            <div className="photo-actions">
              {i > 0 && <button type="button" onClick={() => makeMain(p.id)}>Make main</button>}
              <button type="button" onClick={() => remove(p.id)} aria-label={`Remove photo ${i + 1}`}>Remove</button>
            </div>
          </div>
        ))}
        {photos.length < MAX && (
          <button type="button" className="photo-tile photo-add" onClick={() => input.current.click()} disabled={busy}>
            {busy ? <span className="spinner small-spinner" /> : <><span className="plus">+</span><span>Add photo</span></>}
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={onPick} />
      <p className="muted small">
        Up to {MAX} photos. A clear photo of your face first. Profiles with photos get far more replies. Photos are resized
        and their location data is removed before upload.
      </p>
      {error && <p className="error-box">{error}</p>}
    </div>
  );
}
