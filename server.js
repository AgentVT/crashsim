// CrashSim co-op relay. Rooms by code, up to 8 pilots each. The first pilot in a room is the host and runs the zombies;
// when the host leaves, the next pilot takes over. The server only passes messages along: all physics runs in the browsers.
const { WebSocketServer } = require('ws');
const PORT = +process.env.PORT || 3020;
const wss = new WebSocketServer({ host: process.env.HOST || '127.0.0.1', port: PORT, maxPayload: 256 * 1024 });
const rooms = new Map();
let nextId = 1;
const send = (ws, m) => { if (ws.readyState === 1) ws.send(typeof m === 'string' ? m : JSON.stringify(m)); };
function bcast(r, m, except) { const s = JSON.stringify(m); for (const p of r.peers.values()) if (p !== except) send(p, s); }
function leave(ws) {
  const r = ws.room; if (!r) return;
  r.peers.delete(ws.id); ws.room = null;
  if (!r.peers.size) { rooms.delete(r.code); return; }
  bcast(r, { t: 'gone', id: ws.id });
  if (r.host === ws.id) { r.host = r.peers.keys().next().value; bcast(r, { t: 'host', id: r.host }); }
}
wss.on('connection', ws => {
  ws.id = nextId++; ws.room = null; ws.alive = true;
  ws.on('pong', () => { ws.alive = true; });
  ws.on('message', buf => {
    let m; try { m = JSON.parse(buf); } catch (e) { return; }
    if (!m || typeof m.t !== 'string') return;
    if (m.t === 'join') {
      if (ws.room) return;
      const code = String(m.room || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'PUBLIC';
      let r = rooms.get(code); if (!r) rooms.set(code, r = { code, peers: new Map(), host: 0 });
      if (r.peers.size >= 8) { send(ws, { t: 'full' }); return; }
      ws.room = r; ws.name = String(m.name || 'Pilot').replace(/[<>]/g, '').slice(0, 16); ws.plane = m.plane | 0;
      r.peers.set(ws.id, ws); if (!r.host) r.host = ws.id;
      send(ws, { t: 'welcome', id: ws.id, host: r.host, room: code, peers: [...r.peers.values()].filter(p => p !== ws).map(p => ({ id: p.id, name: p.name, plane: p.plane })) });
      bcast(r, { t: 'peer', id: ws.id, name: ws.name, plane: ws.plane }, ws);
      console.log(new Date().toISOString(), 'join', code, ws.name, `(${r.peers.size} in room)`);
      return;
    }
    const r = ws.room; if (!r) return;
    m.from = ws.id;
    if (m.t === 's') ws.plane = m.a | 0;
    if (m.to) { const p = r.peers.get(m.to); if (p) send(p, m); return; }
    bcast(r, m, ws);
  });
  ws.on('close', () => leave(ws));
  ws.on('error', () => {});
});
setInterval(() => { for (const ws of wss.clients) { if (!ws.alive) { ws.terminate(); continue; } ws.alive = false; ws.ping(); } }, 15000);
console.log('CrashSim co-op relay listening on', PORT);
