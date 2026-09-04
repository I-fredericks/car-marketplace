// In-memory SSE registry: userId -> open event-stream responses.
//
// Single-process only (nodemon / pm2 fork). When scaling to multiple
// instances, swap pushToUser for Redis pub/sub. SSE keeps devops simple:
// plain HTTP, auto-reconnecting clients, works through ngrok tunnels.

const clients = new Map();

function addClient(userId, res) {
  if (!clients.has(userId)) clients.set(userId, new Set());
  clients.get(userId).add(res);
}

function removeClient(userId, res) {
  const set = clients.get(userId);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) clients.delete(userId);
}

function pushToUser(userId, event, data) {
  const set = clients.get(userId);
  if (!set || set.size === 0) return false;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of set) {
    try {
      res.write(payload);
    } catch (_) {
      removeClient(userId, res);
    }
  }
  return true;
}

function clientCount(userId) {
  return clients.get(userId)?.size || 0;
}

module.exports = { addClient, removeClient, pushToUser, clientCount };
