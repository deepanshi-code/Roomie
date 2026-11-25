import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import cors from 'cors';
import express from 'express';
import { CLIENT_ORIGIN, SERVER_ROOT, UPLOAD_DIR } from './config.js';
import {
  CATEGORIES, GENDERS, GENDER_PREFS, HOUSING, IMPORTANCE_LABELS, QUESTIONS, SUGGESTED_INTERESTS,
} from './questions.js';
import authRoutes from './routes/auth.js';
import meRoutes from './routes/me.js';
import discoverRoutes from './routes/discover.js';
import socialRoutes from './routes/social.js';
import agreementRoutes from './routes/agreement.js';
import photoRoutes from './routes/photos.js';
import verifyRoutes from './routes/verify.js';
import publicRoutes from './routes/public.js';
import { attachSocket } from './socket.js';

export function createApp() {
  const app = express();
  app.use(cors({ origin: CLIENT_ORIGIN }));
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', (req, res) => res.json({ ok: true }));
  app.get('/api/meta', (req, res) => res.json({
    questions: QUESTIONS,
    categories: CATEGORIES,
    importanceLabels: IMPORTANCE_LABELS,
    genders: GENDERS,
    housing: HOUSING,
    genderPrefs: GENDER_PREFS,
    interests: SUGGESTED_INTERESTS,
  }));
  app.use('/api/auth', authRoutes);
  app.use('/api', publicRoutes); // no login needed (landing page preview)
  app.use('/api/me', meRoutes);
  app.use('/api', discoverRoutes);
  app.use('/api', socialRoutes);
  app.use('/api', agreementRoutes);
  app.use('/api', photoRoutes);
  app.use('/api', verifyRoutes);
  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

  // Uploaded photos. nosniff stops browsers from guessing a different (e.g. HTML) type.
  app.use('/uploads', express.static(UPLOAD_DIR, {
    maxAge: '7d',
    fallthrough: false,
    setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
  }));

  // In production, serve the built React app from the same origin.
  const dist = path.resolve(SERVER_ROOT, '../client/dist');
  if (fs.existsSync(dist)) {
    app.use(express.static(dist));
    app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON' });
    if (err.status === 404) return res.status(404).end(); // missing upload
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  });

  return app;
}

export function createServer() {
  const app = createApp();
  const server = http.createServer(app);
  const io = attachSocket(server);
  app.set('io', io);
  return { app, server, io };
}
