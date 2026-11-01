import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';

test('standard opening moves are legal and update turns', () => {
  const chess = new Chess();
  assert.equal(chess.move('e4').san, 'e4');
  assert.equal(chess.move('e5').san, 'e5');
  assert.equal(chess.move('Nf3').san, 'Nf3');
  assert.equal(chess.turn(), 'b');
});

test('kingside and queenside castling are legal when clear', () => {
  const kingSide = new Chess('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  assert.equal(kingSide.move('O-O').san, 'O-O');
  const queenSide = new Chess('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  assert.equal(queenSide.move('O-O-O').san, 'O-O-O');
});

test('en passant capture is applied and recorded', () => {
  const chess = new Chess('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1');
  const move = chess.move({ from:'e5', to:'d6' });
  assert.equal(move.flags.includes('e'), true);
  assert.equal(chess.get('d5') ?? null, null);
  assert.equal(chess.get('d6')?.type, 'p');
});

test('all four promotion choices are accepted', () => {
  for (const promotion of ['q','r','b','n']) {
    const chess = new Chess('4k3/P7/8/8/8/8/8/4K3 w - - 0 1');
    const move = chess.move({ from:'a7', to:'a8', promotion });
    assert.equal(move.promotion, promotion);
    assert.equal(chess.get('a8')?.type, promotion);
  }
});

test('Fool’s Mate is identified as checkmate', () => {
  const chess = new Chess();
  for (const san of ['f3','e5','g4','Qh4#']) chess.move(san);
  assert.equal(chess.isCheckmate(), true);
});

test('undo restores the prior FEN and redo-by-replay restores the move', () => {
  const chess = new Chess();
  const start = chess.fen();
  chess.move('e4');
  const after = chess.fen();
  chess.undo();
  assert.equal(chess.fen(), start);
  chess.move('e4');
  assert.equal(chess.fen(), after);
});


test('check and stalemate are distinguished correctly', () => {
  const checked = new Chess('4k3/8/8/8/8/8/8/4R1K1 b - - 0 1');
  assert.equal(checked.isCheck(), true);
  assert.equal(checked.isCheckmate(), false);
  const stalemate = new Chess('7k/5K2/6Q1/8/8/8/8/8 b - - 0 1');
  assert.equal(stalemate.isCheck(), false);
  assert.equal(stalemate.isStalemate(), true);
});

test('fifty-move claim is detected at one hundred half-moves', () => {
  const chess = new Chess('4k2r/8/8/8/8/8/8/4K2R w K - 100 51');
  assert.equal(chess.isDrawByFiftyMoves(), true);
});
