import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import multer from 'multer';
import { db, transaction } from '../db.js';
import { requireAuth } from '../auth.js';
import { UPLOAD_DIR } from '../config.js';
import { getPhotos } from '../users.js';

export const MAX_PHOTOS = 6;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_PHOTO_BYTES, files: 1 } });

/**
 * Identify the image type from its first bytes ("magic numbers"). The file name and the
 * browser-supplied Content-Type are both under the uploader's control, so neither is trusted.
 */
export function sniffImage(buf) {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}

function receive(req, res, next) {
  upload.single('photo')(req, res, (err) => {
    if (!err) return next();
    const error = err.code === 'LIMIT_FILE_SIZE' ? 'Photos must be under 5 MB' : 'Upload failed. Try another photo.';
    res.status(400).json({ error });
  });
}

router.post('/me/photos', requireAuth, receive, (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Choose a photo to upload' });
  const ext = sniffImage(req.file.buffer);
  if (!ext) return res.status(400).json({ error: 'Only JPEG, PNG or WebP images are allowed' });

  const { n, maxPos } = db.prepare('SELECT COUNT(*) AS n, MAX(position) AS maxPos FROM photos WHERE user_id = ?').get(req.userId);
  if (n >= MAX_PHOTOS) return res.status(400).json({ error: `You can have up to ${MAX_PHOTOS} photos. Remove one first.` });

  // Random name: the stored filename never contains anything the user typed.
  const filename = `${randomUUID()}.${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, filename), req.file.buffer);
  db.prepare('INSERT INTO photos (user_id, filename, position) VALUES (?, ?, ?)').run(req.userId, filename, (maxPos ?? -1) + 1);
  res.status(201).json({ photos: getPhotos(req.userId) });
});

router.delete('/me/photos/:id', requireAuth, (req, res) => {
  const photo = db.prepare('SELECT * FROM photos WHERE id = ? AND user_id = ?').get(Number(req.params.id), req.userId);
  if (!photo) return res.status(404).json({ error: 'Photo not found' });
  db.prepare('DELETE FROM photos WHERE id = ?').run(photo.id);
  fs.rmSync(path.join(UPLOAD_DIR, photo.filename), { force: true });
  res.json({ photos: getPhotos(req.userId) });
});

/** Reorder: body { ids } must list exactly the user's photo ids. The first one is the main photo. */
router.put('/me/photos/order', requireAuth, (req, res) => {
  const ids = req.body?.ids;
  const own = getPhotos(req.userId).map((p) => p.id);
  const valid = Array.isArray(ids) && ids.length === own.length
    && new Set(ids).size === ids.length && ids.every((id) => own.includes(id));
  if (!valid) return res.status(400).json({ error: 'Invalid photo order' });
  const stmt = db.prepare('UPDATE photos SET position = ? WHERE id = ? AND user_id = ?');
  transaction(() => ids.forEach((id, i) => stmt.run(i, id, req.userId)));
  res.json({ photos: getPhotos(req.userId) });
});

export default router;
