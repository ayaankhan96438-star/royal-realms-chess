import { Chess } from 'chess.js';
import { difficulties } from './themes.js';

const VALUES = { p:100, n:320, b:335, r:500, q:900, k:20000 };

export class StockfishClient {
  constructor() {
    this.worker = null;
    this.ready = false;
    this.pendingMove = null;
    this.initPromise = null;
    this.activeEngineFile = null;
  }

  init(fullStrength = false) {
    const engineFile = fullStrength ? 'stockfish-19-single.js' : 'stockfish-19-lite-single.js';
    if (this.ready && this.activeEngineFile === engineFile) return Promise.resolve(true);
    if (this.initPromise && this.activeEngineFile === engineFile) return this.initPromise;

    this.worker?.terminate();
    this.worker = null;
    this.ready = false;
    this.initPromise = null;
    this.activeEngineFile = engineFile;

    this.initPromise = new Promise((resolve, reject) => {
      try { this.worker = new Worker(`/engine/${engineFile}`); }
      catch (error) { reject(error); return; }
      const timeout = setTimeout(() => reject(new Error(`Stockfish ${fullStrength ? 'full' : 'lite'} engine did not start. Install engine assets with npm run copy-engine.`)), fullStrength ? 120000 : 20000);
      this.worker.onerror = event => {
        clearTimeout(timeout);
        const error = new Error(event.message || 'Stockfish worker could not load.');
        if (this.pendingMove) { const pending=this.pendingMove; this.pendingMove=null; pending.reject(error); }
        reject(error);
      };
      this.worker.onmessage = event => {
        const lines = String(event.data ?? '').split(/\r?\n/);
        for (const line of lines) {
          if (line.includes('uciok')) {
            this.worker.postMessage('setoption name Threads value 1');
            this.worker.postMessage('setoption name Hash value 64');
            this.worker.postMessage('isready');
          }
          if (line.includes('readyok')) { clearTimeout(timeout); this.ready=true; resolve(true); }
          if (line.startsWith('info ') && this.pendingMove) this.collectCandidate(line);
          if (line.startsWith('bestmove')) {
            const match = line.match(/^bestmove\s+(\S+)/);
            if (this.pendingMove) {
              const pending=this.pendingMove; this.pendingMove=null;
              const best = match && match[1] !== '(none)' ? match[1] : null;
              pending.resolve(this.chooseCandidate(pending, best));
            }
          }
        }
      };
      this.worker.postMessage('uci');
    }).catch(error => { this.initPromise=null; this.activeEngineFile=null; throw error; });
    return this.initPromise;
  }

  collectCandidate(line) {
    const pending = this.pendingMove;
    if (!pending) return;
    const depth = Number(line.match(/\bdepth\s+(\d+)/)?.[1] || 0);
    const multipv = Number(line.match(/\bmultipv\s+(\d+)/)?.[1] || 1);
    const scoreType = line.match(/\bscore\s+(cp|mate)\s+(-?\d+)/);
    const pv = line.match(/\bpv\s+(.+)$/)?.[1]?.trim();
    const uci = pv?.split(/\s+/)[0];
    if (!uci || !scoreType) return;
    const score = scoreType[1] === 'mate' ? Math.sign(Number(scoreType[2])) * (100000 - Math.abs(Number(scoreType[2])) * 100) : Number(scoreType[2]);
    const old = pending.candidates.get(multipv);
    if (!old || depth >= old.depth) pending.candidates.set(multipv, { depth, multipv, score, uci });
  }

  chooseCandidate(pending, bestMove) {
    const candidates = [...pending.candidates.values()].sort((a,b) => b.depth-a.depth || a.multipv-b.multipv);
    const deepest = candidates.length ? Math.max(...candidates.map(item=>item.depth)) : 0;
    const pool = candidates.filter(item=>item.depth===deepest).sort((a,b)=>a.multipv-b.multipv);
    if (!pool.length || !pending.personality || pending.personality === 'royal-master' || pool.length === 1) return bestMove || pool[0]?.uci || null;
    const scored = pool.map(candidate => {
      let style = candidate.score;
      try {
        const probe = new Chess(pending.fen);
        const move = probe.move({ from:candidate.uci.slice(0,2), to:candidate.uci.slice(2,4), promotion:candidate.uci[4] || 'q' });
        if (!move) return { ...candidate, style:-Infinity };
        const central = square => Math.max(0, 4 - (Math.abs(3.5 - 'abcdefgh'.indexOf(square[0])) + Math.abs(3.5 - (Number(square[1])-1))));
        const centreGain = central(move.to) - central(move.from);
        if (pending.personality === 'aggressor') style += (move.captured ? VALUES[move.captured] * .52 : 0) + (probe.isCheck() ? 75 : 0) + (move.promotion ? 180 : 0);
        if (pending.personality === 'guardian') style += (move.san === 'O-O' || move.san === 'O-O-O' ? 45 : 0) - (move.piece === 'k' ? 25 : 0);
        if (pending.personality === 'strategist') style += centreGain * 14 + (move.piece === 'n' || move.piece === 'b' ? 12 : 0);
        if (pending.personality === 'gambler') style += (Math.random() - .5) * 105 + (move.captured ? 18 : 0);
      } catch { return { ...candidate, style:-Infinity }; }
      return { ...candidate, style };
    }).sort((a,b)=>b.style-a.style);
    return scored[0]?.uci || bestMove || null;
  }

  async getMove(fen, difficultyId, personality = 'royal-master') {
    const level = difficulties.find(item => item.id === difficultyId) || difficulties[2];
    await this.init(Boolean(level.fullPower));
    if (!this.worker || !this.ready) throw new Error('Stockfish is not ready.');
    if (this.pendingMove) throw new Error('The engine is already thinking.');
    const multiPv = personality === 'royal-master' ? 1 : 4;
    return new Promise((resolve,reject)=>{
      const timeout = setTimeout(()=>{
        if (this.pendingMove) { const pending=this.pendingMove; this.pendingMove=null; pending.reject(new Error('Stockfish search timed out.')); }
      }, Math.max(30000, level.time * 12));
      this.pendingMove = { fen, personality, candidates:new Map(), resolve:move=>{clearTimeout(timeout);resolve(move);}, reject:error=>{clearTimeout(timeout);reject(error);} };
      this.worker.postMessage('ucinewgame');
      this.worker.postMessage(`setoption name MultiPV value ${multiPv}`);
      this.worker.postMessage(`setoption name UCI_LimitStrength value ${level.fullPower || level.elo ? (level.fullPower ? 'false' : 'true') : 'false'}`);
      if (Number.isFinite(level.elo)) this.worker.postMessage(`setoption name UCI_Elo value ${level.elo}`);
      else this.worker.postMessage(`setoption name Skill Level value ${level.skill ?? 20}`);
      this.worker.postMessage(`position fen ${fen}`);
      this.worker.postMessage(`go movetime ${level.time}`);
    });
  }

  stop() {
    if (this.worker) this.worker.postMessage('stop');
    if (this.pendingMove) { const pending=this.pendingMove; this.pendingMove=null; pending.reject(new Error('Engine search cancelled.')); }
  }

  destroy() {
    this.stop(); this.worker?.terminate(); this.worker=null; this.ready=false; this.initPromise=null; this.activeEngineFile=null;
  }
}
