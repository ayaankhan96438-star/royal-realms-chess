import { Chess } from 'chess.js';
import { themes, difficulties } from './themes.js';
import { StockfishClient } from './engine.js';
import { ThreeChessboard } from './three-board.js';
import './styles.css';

const app = document.querySelector('#app');
const engine = new StockfishClient();
const STORAGE_KEY = 'royal-realms-chess-save-v1';
const PREF_KEY = 'royal-realms-chess-preferences-v1';
const files = 'abcdefgh';
const symbols = {
  w: { k:'♔', q:'♕', r:'♖', b:'♗', n:'♘', p:'♙' },
  b: { k:'♚', q:'♛', r:'♜', b:'♝', n:'♞', p:'♟︎' }
};
const pieceNames = { k:'King', q:'Queen', r:'Rook', b:'Bishop', n:'Knight', p:'Pawn' };
const materialValues = { p:100, n:320, b:335, r:500, q:900, k:20000 };

let game = new Chess();
let screen = 'setup';
let mode = 'computer';
let difficulty = 'medium';
let themeId = 'obsidian-realm';
let humanColor = 'w';
let orientation = 'w';
let selectedSquare = null;
let legalTargets = [];
let lastMove = null;
let thinking = false;
let engineNotice = '';
let engineUnavailable = false;
let gameGeneration = 0;
let toastTimer = null;
let installPrompt = null;
let hapticsEnabled = true;
let sharedAudioContext = null;
let active3DBoard = null;

const savedPrefs = readJSON(PREF_KEY, {});
if (savedPrefs.theme && themes.some(t => t.id === savedPrefs.theme)) themeId = savedPrefs.theme;
if (savedPrefs.difficulty && difficulties.some(d => d.id === savedPrefs.difficulty)) difficulty = savedPrefs.difficulty;
hapticsEnabled = savedPrefs.haptics !== false;

function readJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function currentTheme() { return themes.find(theme => theme.id === themeId) || themes[0]; }
function currentDifficulty() { return difficulties.find(level => level.id === difficulty) || difficulties[2]; }
function savePrefs() {
  localStorage.setItem(PREF_KEY, JSON.stringify({ theme: themeId, difficulty, haptics: hapticsEnabled }));
}
function escapeHTML(value = '') {
  return String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);
}
function selectTheme(id) {
  const theme = themes.find(item => item.id === id);
  if (!theme) return;
  themeId = id;
  savePrefs();
  themeVars();

  document.querySelectorAll('[data-theme]').forEach(button => {
    const selected = button.dataset.theme === id;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });

  const heroImage = document.querySelector('.hero-art img');
  if (heroImage) { heroImage.src = theme.art; heroImage.alt = `${theme.name} chess board concept art`; }
  const heroLabel = document.querySelector('.hero-art-label strong');
  if (heroLabel) heroLabel.textContent = theme.name;
  const heroArt = document.querySelector('.hero-art');
  if (heroArt) heroArt.style.setProperty('--hero-art', `url('${theme.art}')`);

  const selectedImage = document.querySelector('#selected-art');
  if (selectedImage) { selectedImage.src = theme.art; selectedImage.alt = `Preview of ${theme.name}`; }
  const name = document.querySelector('#selected-theme-name');
  const tagline = document.querySelector('#selected-theme-tagline');
  const material = document.querySelector('#selected-theme-material');
  if (name) name.textContent = theme.name;
  if (tagline) tagline.textContent = theme.tagline;
  if (material) material.textContent = theme.material;
  const swatches = document.querySelectorAll('.preview-board-swatches .swatch');
  [theme.light, theme.dark, theme.accent].forEach((color, index) => { if (swatches[index]) swatches[index].style.background = color; });
  const previewRow = document.querySelector('.piece-preview-row');
  if (previewRow) {
    [...previewRow.classList].filter(name => name.startsWith('theme-piece-')).forEach(name => previewRow.classList.remove(name));
    previewRow.classList.add(`theme-piece-${theme.piece}`);
  }
}

function getAudioContext() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedAudioContext) sharedAudioContext = new AudioCtx();
  if (sharedAudioContext.state === 'suspended') sharedAudioContext.resume().catch(() => {});
  return sharedAudioContext;
}

function checkedKingSquare() {
  if (!game.isCheck()) return null;
  const board = game.board();
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece?.type === 'k' && piece.color === game.turn()) return `${files[col]}${8 - row}`;
    }
  }
  return null;
}

function showToast(message, kind = '') {
  let host = document.querySelector('.toast-host');
  if (!host) {
    host = document.createElement('div');
    host.className = 'toast-host';
    document.body.append(host);
  }
  host.innerHTML = `<div class="toast ${kind}">${escapeHTML(message)}</div>`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => host.replaceChildren(), 3600);
}
function themeVars() {
  const theme = currentTheme();
  document.documentElement.style.setProperty('--tile-light', theme.light);
  document.documentElement.style.setProperty('--tile-dark', theme.dark);
  document.documentElement.style.setProperty('--accent', theme.accent);
  document.documentElement.style.setProperty('--accent-glow', theme.glow);
  document.documentElement.style.setProperty('--theme-surface', theme.surface);
}
function persistGame() {
  if (screen !== 'game') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    mode, difficulty, themeId, humanColor, orientation,
    fen: game.fen(), pgn: game.pgn(), updatedAt: Date.now()
  }));
}
function savedGame() { return readJSON(STORAGE_KEY, null); }

function renderSetup() {
  active3DBoard?.destroy();
  active3DBoard = null;
  gameGeneration++;
  engine.stop();
  screen = 'setup';
  thinking = false;
  themeVars();
  const saved = savedGame();
  const theme = currentTheme();
  app.innerHTML = `
    <div class="site-shell setup-shell">
      <header class="topbar">
        <a class="brand" href="#" aria-label="Royal Realms home"><span class="brand-emblem">♔</span><span>ROYAL <i>REALMS</i><small>THE ART OF STRATEGY</small></span></a>
        <div class="topbar-right"><span class="offline-indicator"><span></span> OFFLINE READY</span><button class="icon-button install-button" id="install-app" hidden title="Install game">＋ <span>Install</span></button></div>
      </header>
      <main>
        <section class="hero-block">
          <div class="hero-copy">
            <div class="eyebrow"><span class="eyebrow-line"></span> A NEW CHESS EXPERIENCE</div>
            <h1>Every move<br>creates a <em>legacy.</em></h1>
            <p>Enter a world of handcrafted chess realms. Choose your battlefield, challenge the engine or face a friend across the same board.</p>
            <div class="hero-meta"><span>10 WORLDS</span><b>·</b><span>7 CHALLENGE LEVELS</span><b>·</b><span>PLAY OFFLINE</span></div>
          </div>
          <div class="hero-art" style="--hero-art:url('${theme.art}')">
            <img src="${theme.art}" alt="${escapeHTML(theme.name)} chess board concept art" decoding="async" fetchpriority="high">
            <div class="hero-art-shade"></div><div class="hero-art-label"><span>THE FEATURED REALM</span><strong>${escapeHTML(theme.name)}</strong></div>
            <div class="hero-art-corner">EST. MMXXVI</div>
          </div>
        </section>

        <section class="setup-grid">
          <div class="setup-main-column">
            <div class="section-heading"><div><span class="section-kicker">01 / GAME MODE</span><h2>Choose your opponent</h2></div><span class="section-note">HOW WILL YOU PLAY?</span></div>
            <div class="mode-grid">
              <button class="mode-card ${mode==='computer'?'active':''}" data-mode="computer">
                <span class="mode-icon">♟</span><span class="mode-text"><strong>Play the engine</strong><small>Face the computer, from beginner to grandmaster strength.</small></span><span class="mode-check">${mode==='computer'?'✓':'+'}</span>
              </button>
              <button class="mode-card ${mode==='friend'?'active':''}" data-mode="friend">
                <span class="mode-icon">♟♙</span><span class="mode-text"><strong>Play a friend</strong><small>Two players, one device. Pass the board after every turn.</small></span><span class="mode-check">${mode==='friend'?'✓':'+'}</span>
              </button>
            </div>
            <div class="settings-row ${mode==='computer'?'':'is-muted'}">
              <label class="setting-field" for="difficulty-select"><span class="section-kicker">ENGINE STRENGTH</span><select id="difficulty-select" ${mode==='computer'?'':'disabled'}>${difficulties.map(level=>`<option value="${level.id}" ${difficulty===level.id?'selected':''}>${level.name} · ${level.fullPower?'Full engine strength':Number.isFinite(level.elo)?level.elo+' Elo target':'Skill '+level.skill}</option>`).join('')}</select><small id="difficulty-note">${escapeHTML(currentDifficulty().note)}</small></label>
              <label class="setting-field" for="color-select"><span class="section-kicker">YOUR SIDE</span><select id="color-select" ${mode==='computer'?'':'disabled'}><option value="w" ${humanColor==='w'?'selected':''}>White pieces</option><option value="b" ${humanColor==='b'?'selected':''}>Black pieces</option></select><small>You can also flip the board during a match.</small></label>
            </div>

            <div class="section-heading theme-heading"><div><span class="section-kicker">02 / THE BATTLEFIELD</span><h2>Select your chess realm</h2></div><span class="section-note">10 ORIGINAL WORLDS</span></div>
            <p class="section-description">Every realm has its own board palette, atmosphere and piece treatment. Select a card to preview the world before entering.</p>
            <div class="theme-grid">${themes.map((item,index)=>`
              <button class="theme-card ${themeId===item.id?'selected':''}" data-theme="${item.id}" aria-pressed="${themeId===item.id}">
                <span class="theme-card-art"><img src="${item.art}" alt="${escapeHTML(item.name)} board and pieces" loading="lazy" decoding="async"><span class="theme-number">${String(index+1).padStart(2,'0')}</span><span class="theme-selected-mark">✓</span></span>
                <span class="theme-card-copy"><strong>${escapeHTML(item.name)}</strong><small>${escapeHTML(item.material)}</small></span>
              </button>`).join('')}
            </div>
          </div>
          <aside class="preview-column">
            <div class="preview-sticky">
              <div class="preview-topline"><span class="section-kicker">REALM PREVIEW</span><span class="preview-live"><i></i> LIVE SELECTION</span></div>
              <div class="selected-art"><img id="selected-art" src="${theme.art}" alt="Preview of ${escapeHTML(theme.name)}"><div class="selected-art-overlay"></div><div class="selected-art-copy"><span>YOUR SELECTED WORLD</span><h3 id="selected-theme-name">${escapeHTML(theme.name)}</h3><p id="selected-theme-tagline">${escapeHTML(theme.tagline)}</p></div></div>
              <div class="piece-preview-row theme-piece-${theme.piece}">
                ${['k','q','r','b','n','p'].map(type=>`<div class="mini-piece"><span class="mini-glyph white" aria-hidden="true">${symbols.w[type]}</span><small>${pieceNames[type]}</small></div>`).join('')}
              </div>
              <div class="preview-material"><span>MATERIALS</span><strong id="selected-theme-material">${escapeHTML(theme.material)}</strong></div>
              <div class="preview-board-swatches"><span class="swatch" style="background:${theme.light}"></span><span class="swatch" style="background:${theme.dark}"></span><span class="swatch accent-swatch" style="background:${theme.accent}"></span><small>BOARD PALETTE</small></div>
              <button class="primary-button enter-button" id="start-game">Enter the arena <span>↗</span></button>
              ${saved?`<button class="secondary-button resume-button" id="resume-game">Continue saved game <span>↗</span></button>`:''}
              <p class="preview-footnote"><span>♧</span> Your theme and game can be saved on this device.</p>
            </div>
          </aside>
        </section>
      </main>
      <footer class="site-footer"><span>ROYAL REALMS <i>CHESS</i></span><span>BUILT FOR THINKERS, DREAMERS & RIVALS.</span><span>© 2026</span></footer>
    </div>`;

  app.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => {
    mode = button.dataset.mode;
    renderSetup();
  }));
  app.querySelectorAll('[data-theme]').forEach(button => button.addEventListener('click', () => {
    selectTheme(button.dataset.theme);
  }));
  document.querySelector('#difficulty-select')?.addEventListener('change', event => {
    difficulty = event.target.value; savePrefs();
    document.querySelector('#difficulty-note').textContent = currentDifficulty().note;
  });
  document.querySelector('#color-select')?.addEventListener('change', event => { humanColor = event.target.value; });
  document.querySelector('#start-game')?.addEventListener('click', startGame);
  document.querySelector('#resume-game')?.addEventListener('click', resumeGame);
  document.querySelector('#install-app')?.addEventListener('click', installApp);
  syncInstallButton();
}

function startGame() {
  gameGeneration++;
  game = new Chess();
  lastMove = null;
  selectedSquare = null;
  legalTargets = [];
  orientation = mode === 'friend' ? 'w' : humanColor;
  engineNotice = '';
  engineUnavailable = false;
  screen = 'game';
  savePrefs();
  renderGame();
  persistGame();
  if (mode === 'computer' && game.turn() !== humanColor) computerTurn();
}

function resumeGame() {
  gameGeneration++;
  const saved = savedGame();
  if (!saved) return startGame();
  try {
    mode = saved.mode || 'computer';
    engineUnavailable = false;
    difficulty = saved.difficulty || difficulty;
    themeId = saved.themeId || themeId;
    humanColor = saved.humanColor || 'w';
    orientation = saved.orientation || humanColor;
    game = new Chess();
    if (saved.pgn) game.loadPgn(saved.pgn);
    else if (saved.fen) game.load(saved.fen);
    const history = game.history({ verbose:true });
    lastMove = history.length ? { from:history.at(-1).from, to:history.at(-1).to, animate:false } : null;
    selectedSquare = null; legalTargets = []; thinking = false; engineNotice = '';
    screen = 'game'; renderGame();
    if (mode === 'computer' && game.turn() !== humanColor && !game.isGameOver()) computerTurn();
  } catch (error) {
    showToast('The saved game could not be restored. Starting a new match.', 'warning');
    startGame();
  }
}

function moveAllowedForHuman() {
  return !thinking && !game.isGameOver() && (mode === 'friend' || game.turn() === humanColor);
}

function squareClick(square) {
  if (!moveAllowedForHuman()) return;
  const piece = game.get(square);
  if (selectedSquare) {
    const candidate = legalTargets.find(move => move.to === square);
    if (candidate) {
      if (candidate.promotion) return showPromotionChooser(selectedSquare, square);
      makeHumanMove(selectedSquare, square);
      return;
    }
  }
  if (piece && piece.color === game.turn()) {
    selectedSquare = square;
    legalTargets = game.moves({ square, verbose:true });
  } else {
    selectedSquare = null;
    legalTargets = [];
  }
  renderGame();
}

function showPromotionChooser(from, to) {
  const color = game.turn();
  const choices = ['q','r','b','n'];
  const overlay = document.createElement('div');
  overlay.className = 'modal-backdrop';
  overlay.innerHTML = `<div class="promotion-modal"><span class="section-kicker">PAWN PROMOTION</span><h3>Choose your piece</h3><div class="promotion-choices">${choices.map(type=>`<button data-promotion="${type}"><span>${symbols[color][type]}</span><small>${pieceNames[type]}</small></button>`).join('')}</div><button class="modal-cancel" data-cancel>Cancel</button></div>`;
  document.body.append(overlay);
  overlay.querySelectorAll('[data-promotion]').forEach(button => button.addEventListener('click', () => {
    const promotion = button.dataset.promotion;
    overlay.remove();
    makeHumanMove(from, to, promotion);
  }));
  overlay.querySelector('[data-cancel]').addEventListener('click', () => overlay.remove());
}

function makeHumanMove(from, to, promotion = 'q') {
  try {
    const result = game.move({ from, to, promotion });
    selectedSquare = null; legalTargets = [];
    lastMove = { from:result.from, to:result.to, piece:result.piece, color:result.color, captured:result.captured || null, promotion:result.promotion || null, san:result.san, animate:true };
    persistGame();
    renderGame();
    playMoveEffects(result);
    if (mode === 'computer' && !game.isGameOver() && game.turn() !== humanColor) computerTurn();
  } catch (error) {
    selectedSquare = null; legalTargets = []; renderGame();
  }
}

async function computerTurn() {
  if (mode !== 'computer' || game.isGameOver() || game.turn() === humanColor || thinking) return;
  const requestGeneration = gameGeneration;
  thinking = true;
  selectedSquare = null; legalTargets = [];
  let playedMove = null;
  renderGame();
  try {
    if (engineUnavailable) throw new Error('Stockfish is unavailable in this installation.');
    const uci = await engine.getMove(game.fen(), difficulty);
    if (requestGeneration !== gameGeneration || !uci || game.isGameOver()) return;
    const move = game.move({ from:uci.slice(0,2), to:uci.slice(2,4), promotion:uci[4] || 'q' });
    if (move) {
      lastMove = { from:move.from, to:move.to, piece:move.piece, color:move.color, captured:move.captured || null, promotion:move.promotion || null, san:move.san, animate:true };
      playedMove = move;
      engineNotice = '';
    }
  } catch (error) {
    if (requestGeneration !== gameGeneration) return;
    engineUnavailable = true;
    engineNotice = 'Stockfish is not installed yet. Using the built-in practice opponent. Run npm install to enable the full strength engine.';
    const fallback = findFallbackMove();
    if (fallback) {
      const move = game.move({ from:fallback.from, to:fallback.to, promotion:fallback.promotion || 'q' });
      lastMove = { from:move.from, to:move.to, piece:move.piece, color:move.color, captured:move.captured || null, promotion:move.promotion || null, san:move.san, animate:true };
      playedMove = move;
    }
  } finally {
    if (requestGeneration !== gameGeneration) return;
    thinking = false;
    selectedSquare = null; legalTargets = [];
    persistGame();
    renderGame();
    if (playedMove) playMoveEffects(playedMove);
  }
}

function findFallbackMove() {
  const side = game.turn();
  // This is a safety net only. Keep its main-thread budget short so a missing
  // Stockfish download never freezes the interface.
  const maxDepth = difficulty === 'beginner' ? 1 : 2;
  const budget = { nodes: 0, maxNodes: 900, deadline: performance.now() + 110 };
  const rootMoves = orderMoves(game.moves({ verbose:true }));
  let bestMove = null;
  let bestScore = -Infinity;
  for (const move of rootMoves) {
    game.move({ from:move.from, to:move.to, promotion:move.promotion || 'q' });
    const score = searchPosition(maxDepth - 1, -Infinity, Infinity, side, 1, budget);
    game.undo();
    if (score > bestScore) { bestScore = score; bestMove = move; }
    if (budget.nodes >= budget.maxNodes || performance.now() >= budget.deadline) break;
  }
  return bestMove;
}

function searchPosition(depth, alpha, beta, aiSide, ply, budget) {
  budget.nodes++;
  if (budget.nodes >= budget.maxNodes || performance.now() >= budget.deadline) return evaluatePosition(aiSide);
  if (game.isCheckmate()) return game.turn() === aiSide ? -100000 + ply : 100000 - ply;
  if (game.isDraw() || game.isStalemate() || game.isThreefoldRepetition()) return 0;
  if (depth <= 0) return evaluatePosition(aiSide);
  const moves = orderMoves(game.moves({ verbose:true }));
  const maximizing = game.turn() === aiSide;
  let best = maximizing ? -Infinity : Infinity;
  for (const move of moves) {
    game.move({ from:move.from, to:move.to, promotion:move.promotion || 'q' });
    const score = searchPosition(depth - 1, alpha, beta, aiSide, ply + 1, budget);
    game.undo();
    if (maximizing) { best = Math.max(best, score); alpha = Math.max(alpha, best); }
    else { best = Math.min(best, score); beta = Math.min(beta, best); }
    if (beta <= alpha || budget.nodes >= budget.maxNodes || performance.now() >= budget.deadline) break;
  }
  return best;
}

function orderMoves(moves) {
  return moves.sort((a,b) => (b.captured ? materialValues[b.captured] || 0 : 0) - (a.captured ? materialValues[a.captured] || 0 : 0) + (b.promotion ? 800 : 0) - (a.promotion ? 800 : 0));
}

function evaluatePosition(perspective) {
  const board = game.board();
  let score = 0;
  board.forEach((row, r) => row.forEach((piece, c) => {
    if (!piece) return;
    const value = materialValues[piece.type] || 0;
    const sign = piece.color === perspective ? 1 : -1;
    const centerDistance = Math.abs(3.5 - c) + Math.abs(3.5 - r);
    const centerBonus = piece.type === 'n' || piece.type === 'b' ? (7 - centerDistance) * 5 : 0;
    score += sign * (value + centerBonus);
  }));
  if (game.isCheck()) score += game.turn() === perspective ? -35 : 35;
  return score;
}

function statusText() {
  if (game.isCheckmate()) return `Checkmate — ${game.turn() === 'w' ? 'Black' : 'White'} wins`;
  if (game.isStalemate()) return 'Draw — stalemate';
  if (game.isThreefoldRepetition()) return 'Draw — threefold repetition';
  if (game.isInsufficientMaterial()) return 'Draw — insufficient material';
  if (game.isDraw()) return 'Draw';
  if (thinking) return 'The engine is calculating…';
  if (game.isCheck()) return `${game.turn() === 'w' ? 'White' : 'Black'} is in check`;
  if (mode === 'computer') return game.turn() === humanColor ? 'Your move' : 'Computer to move';
  return `${game.turn() === 'w' ? 'White' : 'Black'} to move`;
}

function capturedPieces() {
  const capturedByWhite = [];
  const capturedByBlack = [];
  for (const move of game.history({ verbose:true })) {
    if (!move.captured) continue;
    if (move.color === 'w') capturedByWhite.push(symbols.b[move.captured]);
    else capturedByBlack.push(symbols.w[move.captured]);
  }
  return { capturedByWhite, capturedByBlack };
}

function renderBoard() {
  // Accessible 2D fallback used only when WebGL is unavailable.
  const rows = [];
  const targetSquares = new Set(legalTargets.map(move => move.to));
  const dangerSquare = checkedKingSquare();
  for (let displayRow = 0; displayRow < 8; displayRow++) {
    for (let displayCol = 0; displayCol < 8; displayCol++) {
      const rank = orientation === 'w' ? 8 - displayRow : 1 + displayRow;
      const fileIndex = orientation === 'w' ? displayCol : 7 - displayCol;
      const square = `${files[fileIndex]}${rank}`;
      const piece = game.get(square);
      const isLight = (fileIndex + rank) % 2 === 0;
      const isSelected = selectedSquare === square;
      const isTarget = targetSquares.has(square);
      const isLast = lastMove && (lastMove.from === square || lastMove.to === square);
      const isDanger = dangerSquare === square;
      const coordFile = displayRow === 7;
      const coordRank = displayCol === 0;
      rows.push(`<button class="board-square ${isLight?'light':'dark'} ${isSelected?'is-selected':''} ${isLast?'last-move':''} ${isTarget?'is-target':''} ${isDanger?'is-king-check':''}" data-square="${square}" aria-label="${square}${piece?`, ${piece.color==='w'?'white':'black'} ${pieceNames[piece.type]}`:''}${isDanger?', in check':''}">
        ${piece?`<span class="piece ${piece.color==='w'?'white':'black'} piece-${piece.type}" aria-hidden="true">${symbols[piece.color][piece.type]}</span>`:''}
        ${isTarget && !piece?'<span class="move-dot"></span>':''}
        ${coordRank?`<span class="coordinate rank-coordinate">${rank}</span>`:''}
        ${coordFile?`<span class="coordinate file-coordinate">${files[fileIndex]}</span>`:''}
      </button>`);
    }
  }
  return rows.join('');
}

function renderMoveList() {
  const moves = game.history({ verbose:true });
  if (!moves.length) return '<div class="empty-history"><span>♜</span><p>Your opening move begins the story.</p></div>';
  const pairs = [];
  for (let i=0;i<moves.length;i+=2) {
    const white = moves[i];
    const black = moves[i+1];
    pairs.push(`<div class="move-row"><span class="move-number">${Math.floor(i/2)+1}.</span><span class="move-san ${i===moves.length-1?'latest':''}">${escapeHTML(white.san)}</span><span class="move-san ${i+1===moves.length-1?'latest':''}">${black?escapeHTML(black.san):''}</span></div>`);
  }
  return pairs.join('');
}

function sideTurnLabel(color, isFinished) {
  if (isFinished || game.turn() !== color) return '';
  if (mode === 'computer') return color === humanColor ? 'YOUR TURN' : 'ENGINE THINKING';
  return 'TO MOVE';
}

function renderGame() {
  screen = 'game';
  themeVars();
  const theme = currentTheme();
  const captured = capturedPieces();
  const finished = game.isGameOver();
  const turn = game.turn();
  const blackName = mode === 'computer' ? (humanColor==='w'?'ROYAL REALMS ENGINE':'YOU') : 'PLAYER TWO';
  const whiteName = mode === 'computer' ? (humanColor==='w'?'YOU':'ROYAL REALMS ENGINE') : 'PLAYER ONE';
  const statusClass = finished ? 'finished' : game.isCheck() ? 'check' : thinking ? 'thinking' : 'playing';
  app.innerHTML = `
    <div class="site-shell game-shell">
      <header class="topbar game-topbar">
        <button class="back-button" id="back-setup">← <span>EXIT MATCH</span></button>
        <a class="brand compact-brand" href="#"><span class="brand-emblem">♔</span><span>ROYAL <i>REALMS</i><small>THE ART OF STRATEGY</small></span></a>
        <div class="topbar-right"><span class="realm-chip"><i></i>${escapeHTML(theme.name)}</span><button class="icon-button" id="game-install" hidden>＋</button></div>
      </header>
      <main class="game-main">
        <div class="game-title-row"><div><span class="section-kicker">THE ARENA / ${mode==='computer'?'ENGINE MATCH':'LOCAL DUEL'}</span><h1>${mode==='computer'?'Challenge the machine.':'Two minds. One board.'}</h1></div><div class="status-pill ${statusClass}" id="status-pill"><i></i><span>${escapeHTML(statusText())}</span></div></div>
        ${game.isCheck()?`<div class="check-banner" role="alert" aria-live="assertive"><span class="check-banner-mark">!</span><span><strong>${game.isCheckmate()?'CHECKMATE': 'CHECK — '+(turn==='w'?'WHITE':'BLACK')+' KING UNDER ATTACK'}</strong><small>${game.isCheckmate()?'The king has no safe move.': 'Your king is threatened. Make a legal move to escape.'}</small></span><b>${game.isCheckmate()?'FINISHED':'DANGER'}</b></div>`:''}
        <div class="play-layout">
          <section class="board-column">
            <div class="player-strip ${turn==='b'?'active-turn':''}" id="black-player">
              <div class="player-avatar black-avatar">♚</div><div class="player-info"><strong>${blackName}</strong><small>BLACK ARMY ${mode==='computer'&&humanColor==='b'?'· YOU':''}</small></div><div class="player-captured">${captured.capturedByWhite.join(' ')}</div><span class="turn-indicator">${sideTurnLabel('b',finished)}</span>
            </div>
            <div class="board-frame theme-piece-${theme.piece}" id="board-frame"><div class="board-grid three-board-host" id="chess-board" aria-label="Chessboard"></div><div class="board-corner-mark">RR</div></div>
            <div class="player-strip bottom-player ${turn==='w'?'active-turn':''}" id="white-player">
              <div class="player-avatar white-avatar">♔</div><div class="player-info"><strong>${whiteName}</strong><small>WHITE ARMY ${mode==='computer'&&humanColor==='w'?'· YOU':''}</small></div><div class="player-captured">${captured.capturedByBlack.join(' ')}</div><span class="turn-indicator">${sideTurnLabel('w',finished)}</span>
            </div>
            <div class="board-tools"><button class="tool-button" id="flip-board">↻ <span>FLIP BOARD</span></button><button class="tool-button" id="undo-move" ${game.history().length?'':'disabled'}>↶ <span>TAKE BACK</span></button><button class="tool-button" id="restart-game">⟲ <span>RESTART</span></button><button class="tool-button" id="save-pgn">⇩ <span>EXPORT PGN</span></button><button class="tool-button haptics-button ${hapticsEnabled?'is-on':''}" id="toggle-haptics" aria-pressed="${hapticsEnabled}">◈ <span>HAPTICS ${hapticsEnabled?'ON':'OFF'}</span></button></div>
            <small class="haptics-note">${typeof navigator.vibrate === 'function' ? 'Haptic API detected · check alerts use device vibration.' : 'Vibration needs a supported Android browser and a device with a vibration motor. Desktop laptops normally cannot vibrate.'}</small>
          </section>
          <aside class="game-sidebar">
            <div class="sidebar-panel match-status-panel"><div class="panel-heading"><span class="section-kicker">MATCH STATUS</span><span class="live-dot"></span></div><div class="status-large">${finished?'Match complete':thinking?'Calculating…':game.isCheck()?'King in danger': 'In progress'}</div><p>${escapeHTML(statusText())}</p>${finished?'<button class="primary-button rematch-button" id="rematch">Play again <span>↗</span></button>':''}</div>
            <div class="sidebar-panel"><div class="panel-heading"><span class="section-kicker">MOVE HISTORY</span><span class="move-count">${game.history().length} PLY</span></div><div class="move-history" id="move-history">${renderMoveList()}</div></div>
            <div class="sidebar-panel captured-panel"><div class="panel-heading"><span class="section-kicker">CAPTURED PIECES</span></div><div class="captured-line"><span>WHITE</span><strong>${captured.capturedByWhite.join(' ')||'—'}</strong></div><div class="captured-line"><span>BLACK</span><strong>${captured.capturedByBlack.join(' ')||'—'}</strong></div></div>
            <div class="engine-card"><div class="engine-icon">✦</div><div><strong>${mode==='computer'?currentDifficulty().name+' Engine':'Local two-player'}</strong><p>${mode==='computer'?'Stockfish-powered when engine files are installed.':'Pass the device after each move.'}</p></div></div>
            ${engineNotice?`<div class="engine-warning">${escapeHTML(engineNotice)}</div>`:''}
            <div class="sidebar-bottom"><span>WORLD SELECTED</span><strong>${escapeHTML(theme.name)}</strong><button id="change-theme" class="text-link">Change realm ↗</button></div>
          </aside>
        </div>
      </main>
      <footer class="site-footer"><span>ROYAL REALMS <i>CHESS</i></span><span>THINK DEEPLY. MOVE BEAUTIFULLY.</span><span>© 2026</span></footer>
    </div>`;

  const boardElement = document.querySelector('#chess-board');
  active3DBoard?.destroy();
  active3DBoard = null;
  try {
    const moveAnimation = lastMove?.animate ? lastMove : null;
    active3DBoard = new ThreeChessboard(boardElement, {
      board: game.board(), orientation, theme, selectedSquare,
      legalTargets: legalTargets.map(move => move.to),
      checkedSquare: checkedKingSquare(), lastMove: moveAnimation,
      onSquareClick: squareClick
    });
    if (lastMove) lastMove.animate = false;
  } catch (error) {
    console.error('The 3D board could not be created; using the accessible 2D board.', error);
    boardElement.classList.remove('three-board-host');
    boardElement.innerHTML = renderBoard();
    boardElement.addEventListener('click', event => {
      const squareButton = event.target.closest('.board-square');
      if (squareButton && boardElement.contains(squareButton)) squareClick(squareButton.dataset.square);
    });
    showToast('3D rendering is unavailable in this browser. Switched to the 2D board.', 'warning');
  }
  document.querySelector('#back-setup').addEventListener('click', renderSetup);
  document.querySelector('#flip-board').addEventListener('click', () => { orientation = orientation==='w'?'b':'w'; persistGame(); renderGame(); });
  document.querySelector('#undo-move').addEventListener('click', undoMove);
  document.querySelector('#restart-game').addEventListener('click', restartGame);
  document.querySelector('#save-pgn').addEventListener('click', exportPGN);
  document.querySelector('#toggle-haptics').addEventListener('click', () => {
    hapticsEnabled = !hapticsEnabled;
    savePrefs();
    lastMove = lastMove ? { ...lastMove, animate:false } : null;
    renderGame();
    if (!hapticsEnabled) showToast('Haptic alerts disabled.');
    else if (typeof navigator.vibrate === 'function') {
      try {
        const sent = navigator.vibrate([45, 35, 70]);
        showToast(sent ? 'Haptic test sent to this device.' : 'The browser exposed vibration, but the device did not accept the request.', sent ? '' : 'warning');
      } catch { showToast('The device/browser rejected the vibration request.', 'warning'); }
    } else showToast('This computer/browser has no Vibration API. Try Chrome on a supported Android phone.', 'warning');
  });
  document.querySelector('#change-theme').addEventListener('click', renderSetup);
  document.querySelector('#rematch')?.addEventListener('click', restartGame);
  document.querySelector('#game-install')?.addEventListener('click', installApp);
  const historyBox = document.querySelector('#move-history');
  if (historyBox) historyBox.scrollTop = historyBox.scrollHeight;
  syncInstallButton();
}

function undoMove() {
  if (thinking) return;
  if (mode === 'computer') {
    if (game.history().length) game.undo();
    if (game.history().length && game.turn() !== humanColor) game.undo();
  } else if (game.history().length) game.undo();
  const history = game.history({ verbose:true });
  lastMove = history.length ? { from:history.at(-1).from, to:history.at(-1).to, animate:false } : null;
  selectedSquare = null; legalTargets = [];
  persistGame(); renderGame();
}

function restartGame() {
  gameGeneration++;
  engine.stop();
  game = new Chess();
  lastMove = null; selectedSquare = null; legalTargets = []; thinking = false; engineNotice = '';
  persistGame(); renderGame();
  if (mode === 'computer' && humanColor === 'b') computerTurn();
}

function exportPGN() {
  const pgn = game.pgn({ maxWidth:80, newline:'\n' });
  const blob = new Blob([pgn || '[Event "Royal Realms Match"]\n\n*'], { type:'application/x-chess-pgn' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = `royal-realms-${new Date().toISOString().slice(0,10)}.pgn`;
  link.click(); URL.revokeObjectURL(url);
  showToast('PGN exported. You can analyse this match later.');
}

function playMoveSound(capture) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = capture ? 240 : 390;
    gain.gain.setValueAtTime(.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(.035, ctx.currentTime + .015);
    gain.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + .12);
    oscillator.connect(gain); gain.connect(ctx.destination);
    oscillator.start(); oscillator.stop(ctx.currentTime + .13);
  } catch { /* Sound is optional if browser audio is unavailable. */ }
}

function playCheckSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [740, 554].forEach((frequency, index) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = now + index * .13;
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(frequency, start);
      oscillator.frequency.exponentialRampToValueAtTime(frequency * .72, start + .23);
      gain.gain.setValueAtTime(.0001, start);
      gain.gain.exponentialRampToValueAtTime(.07, start + .025);
      gain.gain.exponentialRampToValueAtTime(.0001, start + .28);
      oscillator.connect(gain); gain.connect(ctx.destination);
      oscillator.start(start); oscillator.stop(start + .29);
    });
  } catch { /* Haptics and visual warning still work without Web Audio. */ }
}

function playMoveEffects(move) {
  playMoveSound(Boolean(move.captured));
  if (game.isCheckmate()) {
    if (move.piece === 'q') playCinematicScene('/cinematics/queen-checkmates-king.mp4', 'QUEEN CHECKMATES KING');
    else showToast('CHECKMATE — the king has no legal escape.', 'check');
  } else if (move.captured) {
    playCaptureScene(move);
  }
  if (game.isCheck()) announceCheck();
}

function announceCheck() {
  const sideInCheck = game.turn() === 'w' ? 'White' : 'Black';
  const isMate = game.isCheckmate();
  showToast(isMate ? `CHECKMATE — ${sideInCheck} king is trapped.` : `CHECK — ${sideInCheck} king is under attack!`, 'check');
  playCheckSound();
  if (hapticsEnabled && typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try { navigator.vibrate(isMate ? [160, 70, 160, 70, 360] : [130, 55, 230]); } catch { /* Desktop and unsupported browsers cannot provide hardware haptics. */ }
  }
}

function playCaptureScene(move) {
  // These five short clips are the user's own cinematic references. Unmatched
  // captures still receive the live Three.js weapon/impact choreography on the board.
  let clip = null;
  let title = `${pieceNames[move.piece].toUpperCase()} TAKES ${pieceNames[move.captured].toUpperCase()}`;
  if (move.piece === 'n' && move.captured === 'q') clip = '/cinematics/knight-captures-queen.mp4';
  else if (move.piece === 'p') clip = '/cinematics/pawn-battle.mp4';
  else if (move.piece === 'b' && move.captured === 'n') clip = '/cinematics/bishop-defeats-knight.mp4';
  else if (move.piece === 'k' && move.captured === 'p') clip = '/cinematics/king-battles-pawn.mp4';
  if (clip) playCinematicScene(clip, title);
  else showToast(`${title} — cinematic strike!`);
}

function playCinematicScene(source, title) {
  document.querySelector('.cinematic-overlay')?.remove();
  const overlay = document.createElement('div');
  overlay.className = 'cinematic-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-label', title);
  overlay.innerHTML = `
    <div class="cinematic-frame">
      <div class="cinematic-topline"><span>ROYAL REALMS / COMBAT SEQUENCE</span><button type="button" class="cinematic-skip">SKIP ✕</button></div>
      <video class="cinematic-video" src="${source}" autoplay muted playsinline preload="auto"></video>
      <div class="cinematic-caption">${escapeHTML(title)}</div>
      <div class="cinematic-progress"><i></i></div>
    </div>`;
  document.body.append(overlay);
  const video = overlay.querySelector('video');
  const close = () => overlay.remove();
  overlay.querySelector('.cinematic-skip').addEventListener('click', close);
  video.addEventListener('ended', close, { once:true });
  video.addEventListener('error', () => { close(); showToast('The cinematic clip could not load. The 3D board animation has still played.', 'warning'); }, { once:true });
  video.playbackRate = 1.08;
  const playPromise = video.play();
  if (playPromise?.catch) playPromise.catch(() => {
    overlay.querySelector('.cinematic-topline span').textContent = 'CLICK TO PLAY COMBAT SEQUENCE';
    video.controls = true;
  });
  window.setTimeout(close, 8500);
}

async function installApp() {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  syncInstallButton();
}
function syncInstallButton() {
  const buttons = [...document.querySelectorAll('#install-app,#game-install')];
  for (const button of buttons) button.hidden = !installPrompt;
}
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault(); installPrompt = event; syncInstallButton();
});
window.addEventListener('appinstalled', () => { installPrompt = null; syncInstallButton(); showToast('Royal Realms is installed on this device.'); });

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(error => console.warn('Offline caching could not start:', error)));
}

renderSetup();
