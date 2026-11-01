import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GameRoom } from './game-room.js';

const ROOT = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = resolve(ROOT, 'data', 'completed-games.json');
const HOST = process.env.HOST || '0.0.0.0';
const PORT = Number(process.env.PORT || 3002);
const rooms = new Map();
const streams = new Map();
const rateBuckets = new Map();

function code() { return randomBytes(4).toString('hex').toUpperCase(); }
function token() { return randomBytes(32).toString('hex'); }
function json(res, status, value) {
  res.writeHead(status, { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store', 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'Content-Type', 'Access-Control-Allow-Methods':'GET,POST,OPTIONS' });
  res.end(JSON.stringify(value));
}
function allowed(req, res) {
  if (req.method === 'OPTIONS') { json(res, 204, {}); return false; }
  const ip = req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const bucket = rateBuckets.get(ip) || { start: now, count: 0 };
  if (now - bucket.start > 10000) { bucket.start = now; bucket.count = 0; }
  bucket.count++;
  rateBuckets.set(ip, bucket);
  if (bucket.count > 100) { json(res, 429, { error:'Too many requests. Try again shortly.' }); return false; }
  return true;
}
async function body(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 12000) throw new Error('Request body is too large.');
  }
  return raw ? JSON.parse(raw) : {};
}
function broadcast(room) {
  const set = streams.get(room.code);
  if (!set) return;
  for (const client of [...set]) {
    try { client.res.write(`event: state\ndata: ${JSON.stringify(room.snapshot(client.token))}\n\n`); }
    catch { set.delete(client); }
  }
}
async function saveCompleted(room) {
  if (!room.result) return;
  await mkdir(dirname(DATA_FILE), { recursive:true });
  let records = [];
  try { records = JSON.parse(await readFile(DATA_FILE, 'utf8')); } catch { /* first record */ }
  if (!records.some(item => item.code === room.code)) {
    records.unshift({ code:room.code, pgn:room.game.pgn(), fen:room.game.fen(), result:room.result, players:{ w:room.players.w?.name || 'White', b:room.players.b?.name || 'Black' }, completedAt:Date.now() });
    await writeFile(DATA_FILE, JSON.stringify(records.slice(0, 500), null, 2));
  }
}

const server = http.createServer(async (req, res) => {
  if (!allowed(req, res)) return;
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const parts = url.pathname.split('/').filter(Boolean);
  try {
    if (req.method === 'GET' && url.pathname === '/health') return json(res, 200, { status:'ok', service:'Royal Realms Chess room server', activeRooms:rooms.size });
    if (req.method === 'POST' && url.pathname === '/api/rooms') {
      const data = await body(req);
      let roomCode;
      do { roomCode = code(); } while (rooms.has(roomCode));
      const seatToken = token();
      const room = new GameRoom({ code:roomCode, hostToken:seatToken, hostName:data.name || 'White', baseMs:Number(data.baseMs) || 600000, incrementMs:Number(data.incrementMs) || 0 });
      rooms.set(roomCode, room);
      return json(res, 201, { roomCode, token:seatToken, color:'w' });
    }
    if (parts[0] === 'api' && parts[1] === 'rooms' && parts[2]) {
      const room = rooms.get(parts[2].toUpperCase());
      if (!room) return json(res, 404, { error:'Room not found. Check the invitation code.' });
      if (req.method === 'POST' && parts[3] === 'join') {
        const data = await body(req);
        const seatToken = token();
        const color = room.join(seatToken, data.name || 'Black');
        broadcast(room);
        return json(res, 200, { roomCode:room.code, token:seatToken, color });
      }
      if (req.method === 'GET' && parts[3] === 'events') {
        const seatToken = url.searchParams.get('token') || '';
        const color = room.colorFor(seatToken);
        if (!color) return json(res, 403, { error:'Invalid room access token.' });
        res.writeHead(200, { 'Content-Type':'text/event-stream', 'Cache-Control':'no-cache, no-transform', 'Connection':'keep-alive', 'Access-Control-Allow-Origin':'*' });
        res.write(`event: state\ndata: ${JSON.stringify(room.snapshot(seatToken))}\n\n`);
        const set = streams.get(room.code) || new Set();
        const client = { res, token:seatToken };
        set.add(client); streams.set(room.code, set);
        const heartbeat = setInterval(() => { try { res.write(': keep-alive\n\n'); } catch { clearInterval(heartbeat); set.delete(client); } }, 15000);
        res.on('close', () => { clearInterval(heartbeat); set.delete(client); if (!set.size) streams.delete(room.code); });
        return;
      }
      const data = await body(req);
      if (req.method === 'POST' && parts[3] === 'move') {
        const move = room.move(data.token, data.uci);
        broadcast(room); await saveCompleted(room);
        return json(res, 200, { ok:true, san:move.san, state:room.snapshot(data.token) });
      }
      if (req.method === 'POST' && parts[3] === 'draw') {
        const state = room.offerDraw(data.token);
        broadcast(room); await saveCompleted(room);
        return json(res, 200, { ok:true, state, snapshot:room.snapshot(data.token) });
      }
      if (req.method === 'POST' && parts[3] === 'claim-draw') {
        room.claimDraw(data.token); broadcast(room); await saveCompleted(room);
        return json(res, 200, { ok:true, snapshot:room.snapshot(data.token) });
      }
      if (req.method === 'POST' && parts[3] === 'resign') {
        room.resign(data.token); broadcast(room); await saveCompleted(room);
        return json(res, 200, { ok:true, snapshot:room.snapshot(data.token) });
      }
      return json(res, 404, { error:'Unknown room endpoint.' });
    }
    return json(res, 404, { error:'Not found.' });
  } catch (error) {
    return json(res, 400, { error:error.message || 'Request failed.' });
  }
});

server.listen(PORT, HOST, () => console.log(`Royal Realms room server listening on http://${HOST}:${PORT}`));

// Publish authoritative clock snapshots once per second to both connected clients.
setInterval(async () => {
  for (const room of rooms.values()) {
    room.tick();
    broadcast(room);
    if (room.result) await saveCompleted(room);
  }
}, 1000).unref();
