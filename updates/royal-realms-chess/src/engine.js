import { difficulties } from './themes.js';

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

    // Switching between the small and full engine happens only between moves.
    this.worker?.terminate();
    this.worker = null;
    this.ready = false;
    this.initPromise = null;
    this.activeEngineFile = engineFile;

    this.initPromise = new Promise((resolve, reject) => {
      try {
        this.worker = new Worker(`/engine/${engineFile}`);
      } catch (error) {
        reject(error);
        return;
      }
      const timeout = setTimeout(() => {
        reject(new Error(`Stockfish ${fullStrength ? 'full' : 'lite'} engine did not start. Check that the engine files are installed.`));
      }, fullStrength ? 120000 : 20000);
      this.worker.onerror = event => {
        clearTimeout(timeout);
        const error = new Error(event.message || 'Stockfish worker could not load.');
        if (this.pendingMove) {
          const pending = this.pendingMove;
          this.pendingMove = null;
          pending.reject(error);
        }
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
          if (line.includes('readyok')) {
            clearTimeout(timeout);
            this.ready = true;
            resolve(true);
          }
          if (line.startsWith('bestmove')) {
            const match = line.match(/^bestmove\s+(\S+)/);
            if (this.pendingMove) {
              const pending = this.pendingMove;
              this.pendingMove = null;
              pending.resolve(match && match[1] !== '(none)' ? match[1] : null);
            }
          }
        }
      };
      this.worker.postMessage('uci');
    }).catch(error => {
      this.initPromise = null;
      this.activeEngineFile = null;
      throw error;
    });
    return this.initPromise;
  }

  async getMove(fen, difficultyId) {
    const level = difficulties.find(item => item.id === difficultyId) || difficulties[2];
    await this.init(Boolean(level.fullPower));
    if (!this.worker || !this.ready) throw new Error('Stockfish is not ready.');
    if (this.pendingMove) throw new Error('The engine is already thinking.');
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (this.pendingMove) {
          const pending = this.pendingMove;
          this.pendingMove = null;
          pending.reject(new Error('Stockfish search timed out.'));
        }
      }, Math.max(30000, level.time * 12));
      this.pendingMove = {
        resolve: move => { clearTimeout(timeout); resolve(move); },
        reject: error => { clearTimeout(timeout); reject(error); }
      };
      this.worker.postMessage('ucinewgame');
      this.worker.postMessage(`setoption name UCI_LimitStrength value ${level.fullPower || level.elo ? (level.fullPower ? 'false' : 'true') : 'false'}`);
      if (Number.isFinite(level.elo)) this.worker.postMessage(`setoption name UCI_Elo value ${level.elo}`);
      else this.worker.postMessage(`setoption name Skill Level value ${level.skill ?? 20}`);
      this.worker.postMessage(`position fen ${fen}`);
      this.worker.postMessage(`go movetime ${level.time}`);
    });
  }

  stop() {
    if (this.worker) this.worker.postMessage('stop');
    if (this.pendingMove) {
      const pending = this.pendingMove;
      this.pendingMove = null;
      pending.reject(new Error('Engine search cancelled.'));
    }
  }

  destroy() {
    this.stop();
    this.worker?.terminate();
    this.worker = null;
    this.ready = false;
    this.initPromise = null;
    this.activeEngineFile = null;
  }
}
