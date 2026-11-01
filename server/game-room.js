import { Chess } from 'chess.js';

export class GameRoom {
  constructor({ code, hostToken, hostName = 'White', baseMs = 600000, incrementMs = 0 }) {
    this.code = code;
    this.game = new Chess();
    this.players = { w: { token: hostToken, name: hostName }, b: null };
    this.clocks = { w: baseMs, b: baseMs };
    this.baseMs = baseMs;
    this.incrementMs = incrementMs;
    this.turnStartedAt = Date.now();
    this.drawOfferBy = null;
    this.result = null;
    this.createdAt = Date.now();
    this.updatedAt = this.createdAt;
    this.positionHistory = [this.positionKey()];
  }

  colorFor(token) {
    if (this.players.w?.token === token) return 'w';
    if (this.players.b?.token === token) return 'b';
    return null;
  }

  join(token, name = 'Black') {
    if (this.players.b) throw new Error('This private room already has two players.');
    this.players.b = { token, name: String(name).slice(0, 24) || 'Black' };
    this.turnStartedAt = Date.now();
    this.updatedAt = this.turnStartedAt;
    return 'b';
  }

  positionKey() {
    const fields = this.game.fen().split(' ');
    const epIsCapturable = fields[3] !== '-' && this.game.moves({ verbose: true }).some(move => move.flags.includes('e'));
    return [fields[0], fields[1], fields[2], epIsCapturable ? fields[3] : '-'].join(' ');
  }

  repetitionCount() {
    const key = this.positionKey();
    return this.positionHistory.filter(position => position === key).length;
  }

  tick(now = Date.now()) {
    if (this.result || !this.players.b) return;
    const side = this.game.turn();
    const elapsed = Math.max(0, now - this.turnStartedAt);
    this.clocks[side] = Math.max(0, this.clocks[side] - elapsed);
    this.turnStartedAt = now;
    if (this.clocks[side] <= 0) {
      const winner = side === 'w' ? 'b' : 'w';
      this.result = this.game.isInsufficientMaterial()
        ? { type: 'draw', text: 'Draw on time — insufficient mating material.' }
        : { type: 'timeout', winner, text: `${winner === 'w' ? 'White' : 'Black'} wins on time.` };
      this.updatedAt = now;
    }
  }

  move(token, uci) {
    this.tick();
    if (this.result) throw new Error('This game has finished.');
    const color = this.colorFor(token);
    if (!color) throw new Error('You are not a player in this room.');
    if (color !== this.game.turn()) throw new Error('It is not your turn.');
    if (!this.players.b) throw new Error('Waiting for the second player.');
    const text = String(uci || '').trim().toLowerCase();
    if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(text)) throw new Error('Invalid move format.');
    const mover = color;
    let move;
    try { move = this.game.move({ from: text.slice(0, 2), to: text.slice(2, 4), promotion: text[4] || 'q' }); }
    catch { throw new Error('Illegal move.'); }
    if (!move) throw new Error('Illegal move.');
    this.clocks[mover] += this.incrementMs;
    this.turnStartedAt = Date.now();
    this.drawOfferBy = null;
    this.updatedAt = Date.now();
    this.positionHistory.push(this.positionKey());
    if (this.game.isCheckmate()) this.result = { type: 'checkmate', winner: mover, text: `${mover === 'w' ? 'White' : 'Black'} wins by checkmate.` };
    else {
      const halfMoves = Number(this.game.fen().split(' ')[4] || 0);
      if (this.game.isStalemate() || this.game.isInsufficientMaterial()) {
        this.result = { type: 'draw', text: 'Draw — automatic chess rule.' };
      } else if (halfMoves >= 150 || this.repetitionCount() >= 5) {
        this.result = { type: 'draw', text: `Draw — automatic ${halfMoves >= 150 ? 'seventy-five-move rule' : 'fivefold repetition'}.` };
      }
    }
    return move;
  }

  offerDraw(token) {
    const color = this.colorFor(token);
    if (!color) throw new Error('You are not a player in this room.');
    if (this.result) throw new Error('The game has finished.');
    if (this.drawOfferBy && this.drawOfferBy !== color) {
      this.result = { type: 'draw', text: 'Draw agreed.' };
      this.updatedAt = Date.now();
      return 'accepted';
    }
    this.drawOfferBy = color;
    this.updatedAt = Date.now();
    return 'offered';
  }

  claimDraw(token) {
    const color = this.colorFor(token);
    if (!color) throw new Error('You are not a player in this room.');
    if (this.result) throw new Error('The game has finished.');
    if (color !== this.game.turn()) throw new Error('Only the player to move can claim a draw.');
    const fiftyMoveClaim = typeof this.game.isDrawByFiftyMoves === 'function'
      ? this.game.isDrawByFiftyMoves()
      : Number(this.game.fen().split(' ')[4] || 0) >= 100;
    if (this.repetitionCount() < 3 && !fiftyMoveClaim) throw new Error('No claimable draw is available.');
    this.result = { type:'draw', text:'Draw claimed by repetition or the fifty-move rule.' };
    this.updatedAt = Date.now();
    return true;
  }

  resign(token) {
    const color = this.colorFor(token);
    if (!color) throw new Error('You are not a player in this room.');
    if (this.result) throw new Error('The game has finished.');
    const winner = color === 'w' ? 'b' : 'w';
    this.result = { type: 'resignation', winner, text: `${winner === 'w' ? 'White' : 'Black'} wins by resignation.` };
    this.updatedAt = Date.now();
  }

  snapshot(token) {
    this.tick();
    const color = this.colorFor(token);
    if (!color) throw new Error('Invalid room access token.');
    const clocks = { ...this.clocks };
    if (!this.result && this.players.b) clocks[this.game.turn()] = Math.max(0, clocks[this.game.turn()] - Math.max(0, Date.now() - this.turnStartedAt));
    return {
      code: this.code, color, players: this.players.w && this.players.b ? { w: this.players.w.name, b: this.players.b.name } : { w: this.players.w?.name || 'White', b: null },
      fen: this.game.fen(), pgn: this.game.pgn(), turn: this.game.turn(), clocks,
      drawOfferBy: this.drawOfferBy, result: this.result, waiting: !this.players.b,
      check: this.game.isCheck(), checkmate: this.game.isCheckmate(), updatedAt: this.updatedAt
    };
  }
}
