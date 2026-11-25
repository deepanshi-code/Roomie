export const formatINR = (n) => (n == null ? '—' : `₹${Number(n).toLocaleString('en-IN')}`);

export function formatDate(iso) {
  if (!iso) return 'Flexible';
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function timeAgo(iso) {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export const clockTime = (iso) => new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });

export const labelFor = (list, id) => list?.find((x) => x.id === id)?.label ?? id;

/**
 * Shrink a photo in the browser before uploading: max 1280px on the long side, re-encoded as JPEG.
 * Besides saving bandwidth, re-encoding through a canvas DROPS EXIF metadata, which on phone
 * photos often includes the GPS location where the picture was taken.
 */
export async function prepareImage(file, maxSide = 1280) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
    throw new Error('Use a JPEG, PNG or WebP photo (iPhone HEIC photos: share as JPEG first)');
  }
  const bitmap = await createImageBitmap(file); // applies EXIF rotation in modern browsers
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
  if (!blob) throw new Error('Could not process this photo');
  return blob;
}

export const mainPhoto = (user) => user?.photos?.[0]?.url;

export function scoreTone(score) {
  if (score >= 75) return 'good';
  if (score >= 50) return 'ok';
  return 'low';
}

/** Gender as people chose to show it; "Prefer not to say" (or nothing) shows nothing. */
export const genderLabel = (meta, gender) => (!gender || gender === 'prefer_not' ? null : labelFor(meta?.genders, gender));
