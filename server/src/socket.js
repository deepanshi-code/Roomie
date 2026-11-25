import { Server } from 'socket.io';
import { CLIENT_ORIGIN } from './config.js';
import { verifyToken } from './auth.js';
import { getMatchForUser } from './users.js';

/**
 * Real-time layer. Each socket joins a private room `user:<id>`; the REST routes
 * push events (new match, new message, unmatch) into those rooms. Messages are
 * SENT over REST (so they're validated and persisted in one place) and DELIVERED
 * over sockets.
 */
export function attachSocket(httpServer) {
  const io = new Server(httpServer, { cors: { origin: CLIENT_ORIGIN } });

  io.use((socket, next) => {
    const userId = verifyToken(socket.handshake.auth?.token);
    if (!userId) return next(new Error('unauthorized'));
    socket.data.userId = userId;
    next();
  });

  io.on('connection', (socket) => {
    const { userId } = socket.data;
    socket.join(`user:${userId}`);

    socket.on('typing', (payload) => {
      const match = getMatchForUser(Number(payload?.matchId), userId);
      if (!match) return;
      socket.to(`user:${match.otherId}`).emit('typing', { matchId: match.id, userId });
    });
  });

  return io;
}
