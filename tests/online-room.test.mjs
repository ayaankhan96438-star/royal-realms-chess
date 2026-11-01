import test from 'node:test';
import assert from 'node:assert/strict';
import { GameRoom } from '../server/game-room.js';

test('private room assigns seats and validates turns on the server', () => {
  const room = new GameRoom({ code:'ABC123', hostToken:'white-token', baseMs:600000, incrementMs:0 });
  assert.equal(room.colorFor('white-token'), 'w');
  assert.equal(room.join('black-token', 'Black'), 'b');
  assert.throws(() => room.move('black-token', 'e7e5'), /not your turn/i);
  assert.equal(room.move('white-token', 'e2e4').san, 'e4');
  assert.equal(room.move('black-token', 'e7e5').san, 'e5');
  assert.equal(room.game.history().length, 2);
});

test('private room rejects illegal and unauthorized moves', () => {
  const room = new GameRoom({ code:'XYZ123', hostToken:'host' });
  room.join('guest');
  assert.throws(() => room.move('intruder', 'e2e4'), /not a player/i);
  assert.throws(() => room.move('host', 'e2e5'), /illegal move/i);
});

test('draw offers require an opponent response', () => {
  const room = new GameRoom({ code:'DRAW01', hostToken:'w' });
  room.join('b');
  assert.equal(room.offerDraw('w'), 'offered');
  assert.equal(room.offerDraw('b'), 'accepted');
  assert.equal(room.result.type, 'draw');
});

test('resignation awards the result to the other side', () => {
  const room = new GameRoom({ code:'RESIGN', hostToken:'w' });
  room.join('b');
  room.resign('w');
  assert.equal(room.result.winner, 'b');
});


test('server clock starts when the second player joins and move increments are awarded', () => {
  const room = new GameRoom({ code:'CLOCK01', hostToken:'w', baseMs:10000, incrementMs:1000 });
  room.join('b');
  room.turnStartedAt = Date.now() - 2000;
  room.tick(Date.now());
  assert.ok(room.clocks.w <= 8100, `expected white clock near 8s, got ${room.clocks.w}`);
  const beforeMove = room.clocks.w;
  room.move('w', 'e2e4');
  assert.ok(room.clocks.w >= beforeMove + 850, 'expected the 1-second increment after a legal move');
});

test('server allows a valid threefold repetition claim', () => {
  const room = new GameRoom({ code:'REP001', hostToken:'w' });
  room.join('b');
  const line = ['g1f3','g8f6','f3g1','f6g8','g1f3','g8f6','f3g1','f6g8'];
  for (let i=0;i<line.length;i++) room.move(i % 2 === 0 ? 'w' : 'b', line[i]);
  assert.equal(room.game.isThreefoldRepetition(), true);
  assert.equal(room.result, null, 'threefold repetition is claimable, not automatic');
  assert.equal(room.claimDraw('w'), true);
  assert.equal(room.result.type, 'draw');
});

test('private room records checkmate from the legal game state', () => {
  const room = new GameRoom({ code:'MATE01', hostToken:'w' });
  room.join('b');
  for (const [token, uci] of [['w','f2f3'],['b','e7e5'],['w','g2g4'],['b','d8h4']]) room.move(token, uci);
  assert.equal(room.game.isCheckmate(), true);
  assert.equal(room.result.type, 'checkmate');
  assert.equal(room.result.winner, 'b');
});

test('private room automatically draws on fivefold repetition', () => {
  const room = new GameRoom({ code:'REP005', hostToken:'w' });
  room.join('b');
  const cycle = ['g1f3','g8f6','f3g1','f6g8'];
  for (let repeat = 0; repeat < 4; repeat++) {
    for (let i = 0; i < cycle.length; i++) room.move(i % 2 === 0 ? 'w' : 'b', cycle[i]);
  }
  assert.equal(room.repetitionCount(), 5);
  assert.equal(room.result?.type, 'draw');
  assert.match(room.result?.text || '', /fivefold repetition/i);
});
