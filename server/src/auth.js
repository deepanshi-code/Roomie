import jwt from 'jsonwebtoken';
import { JWT_SECRET } from './config.js';

const TOKEN_TTL = '7d';

export function signToken(userId) {
  return jwt.sign({ sub: String(userId) }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

/** Returns the numeric user id, or null if the token is missing/invalid/expired. */
export function verifyToken(token) {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const id = Number(payload.sub);
    return Number.isInteger(id) ? id : null;
  } catch {
    return null;
  }
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const userId = verifyToken(token);
  if (!userId) return res.status(401).json({ error: 'Please log in again' });
  req.userId = userId;
  next();
}

/** Lets async route handlers forward errors to Express 4's error middleware. */
export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export function emitToUser(req, userId, event, payload) {
  req.app.get('io')?.to(`user:${userId}`).emit(event, payload);
}
