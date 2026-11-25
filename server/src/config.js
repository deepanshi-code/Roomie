import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const SERVER_ROOT = path.resolve(__dirname, '..');
export const IS_PROD = process.env.NODE_ENV === 'production';
// In development the Vite proxy expects the API on 4100, so a stray PORT variable
// (set by many tools) is ignored. Hosting platforms set PORT in production.
export const PORT = Number(process.env.API_PORT) || (IS_PROD && Number(process.env.PORT)) || 4100;
export const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-insecure-secret-change-me';
export const DB_PATH = process.env.DB_PATH || path.join(SERVER_ROOT, 'data', 'roomie.db');
export const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5180';
export const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(SERVER_ROOT, 'uploads');

// Email for verification codes. Without SMTP_URL, codes are printed to the server console
// (and returned to the browser outside production) so the feature works locally.
export const SMTP_URL = process.env.SMTP_URL || '';
export const MAIL_FROM = process.env.MAIL_FROM || 'Roomie <no-reply@roomie.local>';

if (IS_PROD && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be set when NODE_ENV=production');
}
