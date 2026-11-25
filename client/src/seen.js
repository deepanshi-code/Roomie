// Remembers, per user and match, the timestamp of the newest message you have seen.
// Stored in localStorage, so "unread" is per device. The server timestamp of the message
// is stored (not the device clock) so clock differences between devices don't matter.
const key = (userId) => `roomie_seen_${userId}`;

export function readSeen(userId) {
  try {
    return JSON.parse(localStorage.getItem(key(userId))) ?? {};
  } catch {
    return {};
  }
}

export function markSeen(userId, matchId, createdAt) {
  const seen = readSeen(userId);
  if (seen[matchId] && seen[matchId] >= createdAt) return seen;
  const next = { ...seen, [matchId]: createdAt };
  try { localStorage.setItem(key(userId), JSON.stringify(next)); } catch { /* storage full or blocked: unread just won't persist */ }
  return next;
}

/** A match is unread when its newest message came from the other person after what you last saw. */
export const isUnread = (match, userId, seen) =>
  Boolean(match.lastMessage && match.lastMessage.senderId !== userId && !(seen[match.id] >= match.lastMessage.createdAt));
