import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { openings, puzzles } from '../src/training/catalog.js';

test('all opening academy lines are legal from the standard start', () => {
  for (const opening of openings) {
    const chess = new Chess();
    for (const san of opening.moves) assert.doesNotThrow(() => chess.move(san), `${opening.name}: ${san}`);
  }
});

test('all puzzle prefixes and solution lines are legal', () => {
  for (const puzzle of puzzles) {
    const chess = new Chess();
    for (const san of puzzle.prefix) chess.move(san);
    assert.equal(chess.turn(), puzzle.side, `${puzzle.title}: expected side to move`);
    for (const san of puzzle.solution) assert.doesNotThrow(() => chess.move(san), `${puzzle.title}: ${san}`);
    if (puzzle.solution.at(-1)?.includes('#')) assert.equal(chess.isCheckmate(), true, `${puzzle.title}: final move must be mate`);
  }
});
