import { Chess } from 'chess.js';
import { themes, difficulties } from './themes.js';
import { StockfishClient } from './engine.js';
import { ThreeChessboard } from './three-board.js';
import { dbPut, dbGet } from './storage/local-db.js';
import { openings, puzzles } from './training/catalog.js';
import './styles.css';

const app = document.querySelector('#app');
const engine = new StockfishClient();
const STORAGE_KEY = 'royal-realms-chess-save-v1';
const PREF_KEY = 'royal-realms-chess-preferences-v1';
const STATS_KEY = 'royal-realms-chess-stats-v1';
const PROFILE_KEY = 'royal-realms-chess-profile-v1';
const FINISHED_KEY = 'royal-realms-chess-finished-v1';
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
let personality = 'royal-master';
let woodFinish = 'heritage';
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
let soundEnabled = true;
let animationsEnabled = !(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false);
let sharedAudioContext = null;
let sharedNoiseBuffer = null;
const woodAudioSamples = new Map();
let active3DBoard = null;
let setup3DBoard = null;
let animationLockUntil = 0;
let timeControlId = '10+0';
let clockRemaining = { w:600000, b:600000 };
let clockIncrementMs = 0;
let clockLastTick = 0;
let clockInterval = null;
let clockStarted = false;
let clockSnapshots = [];
let redoStack = [];
let gameResult = null;
let drawOfferBy = null;
let puzzleSession = null;
let openingDemo = null;
let onlineSession = null;
let profileData = readJSON(PROFILE_KEY, { name:'Player One' });
let localStats = readJSON(STATS_KEY, { games:0, wins:0, losses:0, draws:0, streak:0, bestStreak:0, achievements:[] });

const savedPrefs = readJSON(PREF_KEY, {});
if (savedPrefs.theme && themes.some(t => t.id === savedPrefs.theme)) themeId = savedPrefs.theme;
if (['heritage','walnut','oak','ebony','cherry'].includes(savedPrefs.woodFinish)) woodFinish = savedPrefs.woodFinish;
if (savedPrefs.difficulty && difficulties.some(d => d.id === savedPrefs.difficulty)) difficulty = savedPrefs.difficulty;
hapticsEnabled = savedPrefs.haptics !== false;
soundEnabled = savedPrefs.sound !== false;
if (typeof savedPrefs.animations === 'boolean') animationsEnabled = savedPrefs.animations;

function readJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function currentTheme() { return themes.find(theme => theme.id === themeId) || themes[0]; }
function currentDifficulty() { return difficulties.find(level => level.id === difficulty) || difficulties[2]; }
function savePrefs() {
  localStorage.setItem(PREF_KEY, JSON.stringify({ theme: themeId, difficulty, haptics: hapticsEnabled, sound: soundEnabled, animations: animationsEnabled, timeControl:timeControlId, personality, woodFinish }));
  void dbPut('preferences', 'main', { theme:themeId, difficulty, haptics:hapticsEnabled, sound:soundEnabled, animations:animationsEnabled, timeControl:timeControlId, woodFinish });
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
  refreshSetupPreview();
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
  if (screen !== 'game' || mode === 'online' || mode === 'puzzle') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    mode, difficulty, themeId, humanColor, orientation,
    fen: game.fen(), pgn: game.pgn(), updatedAt: Date.now(), clockRemaining, timeControlId, clockSnapshots, gameResult, drawOfferBy
  }));
  void dbPut('games', 'active', { mode, difficulty, themeId, humanColor, orientation, fen:game.fen(), pgn:game.pgn(), clockRemaining, timeControlId, clockSnapshots, gameResult, drawOfferBy, updatedAt:Date.now() });
}
function savedGame() { return readJSON(STORAGE_KEY, null); }

function renderSetup() {
  animationLockUntil = 0;
  stopClock();
  onlineSession?.events?.close(); onlineSession = null;
  active3DBoard?.destroy();
  active3DBoard = null;
  setup3DBoard?.destroy();
  setup3DBoard = null;
  gameGeneration++;
  engine.stop();
  if (mode === 'online' || mode === 'puzzle') mode = 'computer';
  puzzleSession = null;
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
      <nav class="dashboard-nav" aria-label="Chess sections">
        <button class="dashboard-nav-button active" data-dashboard="play">Play</button>
        <button class="dashboard-nav-button" data-dashboard="puzzles">Puzzles</button>
        <button class="dashboard-nav-button" data-dashboard="openings">Opening academy</button>
        <button class="dashboard-nav-button" data-dashboard="games">My games</button>
        <button class="dashboard-nav-button" data-dashboard="profile">Profile & stats</button>
        <button class="dashboard-nav-button" data-dashboard="settings">Settings</button>
        <button class="dashboard-nav-button online-nav-button" id="online-open">Private online match</button>
      </nav>
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
            <div class="settings-row time-settings-row">
              <label class="setting-field" for="time-control-select"><span class="section-kicker">TIME CONTROL</span>
                <select id="time-control-select">
                  ${[['1+0','Bullet 1+0'],['2+1','Bullet 2+1'],['3+0','Blitz 3+0'],['3+2','Blitz 3+2'],['5+0','Blitz 5+0'],['10+0','Rapid 10+0'],['15+10','Rapid 15+10'],['30+0','Classical 30+0'],['custom','Custom…']].map(([value,label])=>`<option value="${value}" ${timeControlId===value?'selected':''}>${label}</option>`).join('')}
                  ${!['1+0','2+1','3+0','3+2','5+0','10+0','15+10','30+0'].includes(timeControlId)?`<option value="${timeControlId}" selected>Custom · ${timeControlId}</option>`:''}
                </select><small>Clock starts with the first turn and adds the selected increment.</small>
              </label>
              <label class="setting-field" for="player-name"><span class="section-kicker">PLAYER NAME</span><input id="player-name" maxlength="24" value="${escapeHTML(profileData.name || 'Player One')}" placeholder="Your display name"><small>Stored locally on this device.</small></label>
              <label class="setting-field" for="personality-select"><span class="section-kicker">ENGINE PERSONALITY</span><select id="personality-select" ${mode==='computer'?'':'disabled'}>${[['royal-master','Royal Master'],['aggressor','The Aggressor'],['guardian','The Guardian'],['strategist','The Strategist'],['gambler','The Gambler']].map(([value,label])=>`<option value="${value}" ${personality===value?'selected':''}>${label}</option>`).join('')}</select><small>Chooses between the engine’s top multi-PV candidates using a small style preference.</small></label>
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
              <div class="live-preview-board-wrap"><div class="live-preview-label"><span>LIVE 3D PREVIEW</span><span>STAUNTON WOOD SET</span></div><div class="live-preview-board" id="setup-board-preview" aria-label="Three-dimensional preview of the selected chess board"></div></div>
              <div class="selected-theme-copy"><span>YOUR SELECTED WORLD</span><h3 id="selected-theme-name">${escapeHTML(theme.name)}</h3><p id="selected-theme-tagline">${escapeHTML(theme.tagline)}</p></div>
              <div class="piece-preview-row theme-piece-${theme.piece}">
                ${['k','q','r','b','n','p'].map(type=>`<div class="mini-piece"><span class="mini-glyph white" aria-hidden="true">${symbols.w[type]}</span><small>${pieceNames[type]}</small></div>`).join('')}
              </div>
              <div class="preview-material"><span>MATERIALS</span><strong id="selected-theme-material">${escapeHTML(theme.material)}</strong></div>
              <div class="preview-board-swatches"><span class="swatch" style="background:${theme.light}"></span><span class="swatch" style="background:${theme.dark}"></span><span class="swatch accent-swatch" style="background:${theme.accent}"></span><small>BOARD PALETTE</small></div>
              <button class="primary-button enter-button" id="start-game">Enter the arena <span>↗</span></button>
              ${saved?`<button class="secondary-button resume-button" id="resume-game">Continue saved game <span>↗</span></button>`:''}
              <div class="setup-preferences">
                <label><input id="setup-sound" type="checkbox" ${soundEnabled?'checked':''}> <span>Move sounds</span></label>
                <label><input id="setup-motion" type="checkbox" ${animationsEnabled?'checked':''}> <span>Move animations</span></label>
                <label><input id="setup-haptics" type="checkbox" ${hapticsEnabled?'checked':''}> <span>Haptic alerts</span></label>
              </div>
              <p class="preview-footnote"><span>♧</span> Preferences and unfinished games are saved on this device.</p>
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
  document.querySelector('#setup-sound')?.addEventListener('change', event => { soundEnabled = event.target.checked; savePrefs(); });
  document.querySelector('#setup-motion')?.addEventListener('change', event => { animationsEnabled = event.target.checked; savePrefs(); });
  document.querySelector('#setup-haptics')?.addEventListener('change', event => { hapticsEnabled = event.target.checked; savePrefs(); });
  document.querySelector('#time-control-select')?.addEventListener('change', event => {
    if (event.target.value === 'custom') {
      const minutes = Math.min(180, Math.max(1, Number(prompt('Initial minutes (1–180):', '10')) || 10));
      const increment = Math.min(60, Math.max(0, Number(prompt('Increment seconds (0–60):', '0')) || 0));
      timeControlId = `${minutes}+${increment}`;
      event.target.value = '';
    } else timeControlId = event.target.value;
    savePrefs();
  });
  document.querySelector('#personality-select')?.addEventListener('change', event => { personality = event.target.value; savePrefs(); });
  document.querySelector('#player-name')?.addEventListener('change', event => { profileData.name = event.target.value.trim().slice(0,24) || 'Player One'; localStorage.setItem(PROFILE_KEY, JSON.stringify(profileData)); void dbPut('stats','profile',profileData); });
  app.querySelectorAll('[data-dashboard]').forEach(button => button.addEventListener('click', () => openDashboardPage(button.dataset.dashboard)));
  document.querySelector('#online-open')?.addEventListener('click', renderOnlineLobby);
  syncInstallButton();
  refreshSetupPreview();
}

function refreshSetupPreview() {
  setup3DBoard?.destroy();
  setup3DBoard = null;
  const host = document.querySelector('#setup-board-preview');
  if (!host) return;
  try {
    setup3DBoard = new ThreeChessboard(host, {
      board: new Chess().board(),
      orientation: 'w',
      theme: currentTheme(),
      woodFinish,
      interactive: false,
      animationsEnabled: false
    });
  } catch (error) {
    const detail = error?.message || String(error);
    window.__ROYAL_REALMS_3D_ERROR__ = detail;
    console.warn('Royal Realms 3D preview unavailable:', error);
    host.innerHTML = `<div class="preview-fallback"><strong>3D preview unavailable — WebGL2 required</strong><small>${escapeHTML(detail)}</small><small>Enable Chrome hardware acceleration, restart the browser, then reload Royal Realms.</small></div>`;
  }
}

function startGame() {
  onlineSession?.events?.close(); onlineSession = null;
  setup3DBoard?.destroy();
  setup3DBoard = null;
  gameGeneration++;
  game = new Chess();
  gameResult = null; drawOfferBy = null; puzzleSession = null; redoStack = []; clockSnapshots = [];
  initGameClock();
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
    timeControlId = saved.timeControlId || timeControlId;
    gameResult = saved.gameResult || null; drawOfferBy = saved.drawOfferBy || null;
    clockRemaining = saved.clockRemaining || getTimeConfig(timeControlId).initial;
    clockIncrementMs = getTimeConfig(timeControlId).increment;
    clockSnapshots = [{ ...clockRemaining }];
    redoStack = [];
    game = new Chess();
    if (saved.pgn) game.loadPgn(saved.pgn);
    else if (saved.fen) game.load(saved.fen);
    if (Array.isArray(saved.clockSnapshots) && saved.clockSnapshots.length) clockSnapshots = saved.clockSnapshots.map(item=>({...item}));
    else clockSnapshots = Array.from({ length:game.history().length + 1 }, () => ({ ...clockRemaining }));
    const history = game.history({ verbose:true });
    lastMove = history.length ? { from:history.at(-1).from, to:history.at(-1).to, animate:false } : null;
    selectedSquare = null; legalTargets = []; thinking = false; engineNotice = '';
    screen = 'game'; startClock(); renderGame();
    if (mode === 'computer' && game.turn() !== humanColor && !game.isGameOver()) computerTurn();
  } catch (error) {
    showToast('The saved game could not be restored. Starting a new match.', 'warning');
    startGame();
  }
}

function moveAllowedForHuman() {
  return !thinking && Date.now() >= animationLockUntil && !isGameFinished() && (mode === 'friend' || mode === 'puzzle' && puzzleSession?.side === game.turn() || mode === 'online' && onlineSession?.color === game.turn() || mode === 'computer' && game.turn() === humanColor);
}

function refreshSelection() {
  if (active3DBoard && typeof active3DBoard.setHighlights === 'function') {
    active3DBoard.setHighlights(selectedSquare, legalTargets.map(move => move.to), checkedKingSquare(), game.isCheckmate());
  } else {
    renderGame();
  }
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
  refreshSelection();
}

function squareDrop(from, to) {
  if (!moveAllowedForHuman()) return;
  const piece = game.get(from);
  if (!piece || piece.color !== game.turn()) return;
  const candidate = game.moves({ square:from, verbose:true }).find(move => move.to === to);
  if (!candidate) {
    squareClick(to);
    return;
  }
  if (candidate.promotion) return showPromotionChooser(from, to);
  makeHumanMove(from, to);
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
  if (mode === 'online') {
    selectedSquare = null; legalTargets = []; refreshSelection();
    void submitOnlineMove(from, to, promotion === 'q' ? '' : promotion);
    return;
  }
  if (mode === 'puzzle' && puzzleSession) {
    const expected = puzzleSession.solution[puzzleSession.index];
    const attempted = game.moves({ verbose:true }).find(move => move.from === from && move.to === to && (move.promotion || 'q') === (promotion || 'q'));
    if (!attempted || attempted.san.replace(/[+#]$/, '') !== String(expected).replace(/[+#]$/, '')) {
      showToast('Not the puzzle solution. Look for the forcing move.', 'warning');
      selectedSquare = null; legalTargets = []; refreshSelection(); return;
    }
  }
  if (!settleClockForMove()) return;
  const mover = game.turn();
  try {
    const result = game.move({ from, to, promotion });
    redoStack = [];
    selectedSquare = null; legalTargets = [];
    lastMove = { from:result.from, to:result.to, piece:result.piece, color:result.color, captured:result.captured || null, promotion:result.promotion || null, san:result.san, animate:true };
    completeClockMove(mover);
    if (mode === 'puzzle' && puzzleSession) {
      puzzleSession.index++;
      if (puzzleSession.index >= puzzleSession.solution.length) {
        puzzleSession.solved = true;
        gameResult = { type:'puzzle', text:'Puzzle solved — excellent calculation.' };
        stopClock();
        showToast('Puzzle solved — excellent calculation.', 'success');
        const known = new Set(localStats.achievements || []); known.add('Puzzle Master'); localStats.achievements=[...known]; localStorage.setItem(STATS_KEY,JSON.stringify(localStats));
      }
    }
    persistGame();
    renderGame();
    playMoveEffects(result);
    if (mode !== 'puzzle') finishIfRulesEnded();
    const movePause = animationsEnabled ? (result.captured ? 1850 : 430) : 0;
    animationLockUntil = Date.now() + movePause;
    if (mode === 'computer' && !isGameFinished() && game.turn() !== humanColor) {
      window.setTimeout(() => {
        if (screen === 'game' && !isGameFinished() && game.turn() !== humanColor) computerTurn();
      }, movePause);
    }
  } catch (error) {
    selectedSquare = null; legalTargets = []; renderGame();
    showToast(`Move rejected: ${error.message}`, 'warning');
  }
}

async function computerTurn() {
  if (mode !== 'computer' || isGameFinished() || game.turn() === humanColor || thinking) return;
  const requestGeneration = gameGeneration;
  thinking = true;
  selectedSquare = null; legalTargets = [];
  let playedMove = null;
  renderGame();
  try {
    if (engineUnavailable) throw new Error('Stockfish is unavailable in this installation.');
    const uci = await engine.getMove(game.fen(), difficulty, personality);
    if (requestGeneration !== gameGeneration || !uci || game.isGameOver()) return;
    const mover = game.turn();
    const move = game.move({ from:uci.slice(0,2), to:uci.slice(2,4), promotion:uci[4] || 'q' });
    if (move) {
      completeClockMove(mover);
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
      const mover = game.turn();
      const move = game.move({ from:fallback.from, to:fallback.to, promotion:fallback.promotion || 'q' });
      completeClockMove(mover);
      lastMove = { from:move.from, to:move.to, piece:move.piece, color:move.color, captured:move.captured || null, promotion:move.promotion || null, san:move.san, animate:true };
      playedMove = move;
    }
  } finally {
    if (requestGeneration !== gameGeneration) return;
    thinking = false;
    selectedSquare = null; legalTargets = [];
    persistGame();
    renderGame();
    if (playedMove) {
      animationLockUntil = Date.now() + (animationsEnabled ? (playedMove.captured ? 2180 : 470) : 0);
      playMoveEffects(playedMove);
      finishIfRulesEnded();
    }
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
  if (gameResult?.text) return gameResult.text;
  if (puzzleSession?.solved) return 'Puzzle solved — excellent work.';
  if (game.isCheckmate()) return `Checkmate — ${game.turn() === 'w' ? 'Black' : 'White'} wins`;
  if (game.isStalemate()) return 'Draw — stalemate';
  if (game.isThreefoldRepetition()) return 'Draw — threefold repetition';
  if (game.isInsufficientMaterial()) return 'Draw — insufficient material';
  if (game.isDraw()) return 'Draw';
  if (thinking) return 'The engine is calculating…';
  if (game.isCheck()) return `${game.turn() === 'w' ? 'White' : 'Black'} is in check`;
  if (mode === 'computer') return game.turn() === humanColor ? 'Your move' : 'Computer to move';
  if (mode === 'online') return onlineSession?.waiting ? 'Waiting for opponent to join' : game.turn() === onlineSession?.color ? 'Your online move' : 'Opponent to move';
  if (mode === 'puzzle') return puzzleSession?.solved ? 'Puzzle solved' : 'Find the best move';
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
  const finished = isGameFinished();
  const turn = game.turn();
  const blackName = mode === 'computer' ? (humanColor==='w'?'ROYAL REALMS ENGINE':escapeHTML(profileData.name||'YOU')) : mode === 'online' ? (onlineSession?.players?.b || (onlineSession?.color==='b'?'YOU':'WAITING FOR PLAYER')) : mode === 'puzzle' ? 'PUZZLE OPPONENT' : 'PLAYER TWO';
  const whiteName = mode === 'computer' ? (humanColor==='w'?escapeHTML(profileData.name||'YOU'):'ROYAL REALMS ENGINE') : mode === 'online' ? (onlineSession?.players?.w || (onlineSession?.color==='w'?'YOU':'WAITING FOR PLAYER')) : mode === 'puzzle' ? 'PUZZLE PLAYER' : 'PLAYER ONE';
  const statusClass = finished ? 'finished' : game.isCheck() ? 'check' : thinking ? 'thinking' : 'playing';
  app.innerHTML = `
    <div class="site-shell game-shell mode-${mode}">
      <header class="topbar game-topbar">
        <button class="back-button" id="back-setup">← <span>EXIT MATCH</span></button>
        <a class="brand compact-brand" href="#"><span class="brand-emblem">♔</span><span>ROYAL <i>REALMS</i><small>THE ART OF STRATEGY</small></span></a>
        <div class="topbar-right"><span class="realm-chip"><i></i>${escapeHTML(theme.name)}</span><button class="icon-button" id="game-install" hidden>＋</button></div>
      </header>
      <main class="game-main">
        <div class="game-title-row"><div><span class="section-kicker">THE ARENA / ${mode==='computer'?'ENGINE MATCH':mode==='online'?'ONLINE PRIVATE MATCH':mode==='puzzle'?'PUZZLE TRAINING':'LOCAL DUEL'}</span><h1>${mode==='computer'?'Challenge the machine.':mode==='online'?'A live match across two devices.':mode==='puzzle'?'Find the strongest continuation.':'Two minds. One board.'}</h1></div><div class="status-pill ${statusClass}" id="status-pill"><i></i><span>${escapeHTML(statusText())}</span></div></div>
        ${game.isCheck()?`<div class="check-banner ${game.isCheckmate()?'is-mate':'is-check'}" role="status" aria-live="polite"><span class="check-banner-mark">${game.isCheckmate()?'♛':'!'}</span><span><strong>${game.isCheckmate()?'CHECKMATE': 'CHECK — '+(turn==='w'?'WHITE':'BLACK')+' KING UNDER ATTACK'}</strong><small>${game.isCheckmate()?'The match is over. The king has no legal escape.': 'Your king is threatened. Find a safe move.'}</small></span><b>${game.isCheckmate()?'MATCH OVER':'CHECK'}</b></div>`:''}
        <div class="play-layout">
          <section class="board-column">
            <div class="player-strip ${turn==='b'?'active-turn':''}" id="black-player">
              <div class="player-avatar black-avatar">♚</div><div class="player-info"><strong>${blackName}</strong><small>BLACK ARMY ${mode==='computer'&&humanColor==='b'?'· YOU':''}</small></div><div class="player-captured">${captured.capturedByWhite.join(' ')}</div><div class="player-clock" id="black-clock">${formatClock(clockRemaining.b)}</div><span class="turn-indicator">${sideTurnLabel('b',finished)}</span>
            </div>
            <div class="board-frame theme-piece-${theme.piece}" id="board-frame"><div class="renderer-mode-mark" id="renderer-mode-mark">LIVE 3D WOOD SET</div><div class="board-grid three-board-host" id="chess-board" aria-label="Chessboard"></div>${lastMove?.animate && lastMove.captured ? `<div class="combat-callout" role="status" aria-live="polite"><span>${escapeHTML(pieceNames[lastMove.piece].toUpperCase())}</span><i>TAKES</i><strong>${escapeHTML(pieceNames[lastMove.captured].toUpperCase())}</strong></div>` : ''}<div class="board-corner-mark">RR</div></div>
            <div class="player-strip bottom-player ${turn==='w'?'active-turn':''}" id="white-player">
              <div class="player-avatar white-avatar">♔</div><div class="player-info"><strong>${whiteName}</strong><small>WHITE ARMY ${mode==='computer'&&humanColor==='w'?'· YOU':''}</small></div><div class="player-captured">${captured.capturedByBlack.join(' ')}</div><div class="player-clock" id="white-clock">${formatClock(clockRemaining.w)}</div><span class="turn-indicator">${sideTurnLabel('w',finished)}</span>
            </div>
            <div class="board-tools"><button class="tool-button" id="flip-board">↻ <span>FLIP BOARD</span></button><button class="tool-button" id="hint-move" ${mode==='online' || mode==='puzzle'?'disabled':''}>✦ <span>ROYAL HINT</span></button><button class="tool-button" id="zoom-out" title="Zoom out">− <span>ZOOM OUT</span></button><button class="tool-button" id="zoom-in" title="Zoom in">＋ <span>ZOOM IN</span></button><button class="tool-button" id="rotate-view-left" title="Rotate camera left">⟲ <span>ROTATE LEFT</span></button><button class="tool-button" id="rotate-view-right" title="Rotate camera right">⟳ <span>ROTATE RIGHT</span></button><button class="tool-button" id="reset-camera" title="Reset camera">⌂ <span>RESET VIEW</span></button><button class="tool-button" id="board-fullscreen" title="Fullscreen">⛶ <span>FULLSCREEN</span></button><button class="tool-button" id="undo-move" ${mode==='online' || mode==='puzzle' || !game.history().length?'disabled':''}>↶ <span>UNDO</span></button><button class="tool-button" id="redo-move" ${mode==='online' || mode==='puzzle' || !redoStack.length?'disabled':''}>↷ <span>REDO</span></button><button class="tool-button" id="restart-game" ${mode==='online'?'disabled':''}>⟲ <span>RESTART</span></button><button class="tool-button" id="save-pgn">⇩ <span>EXPORT PGN</span></button><button class="tool-button" id="import-pgn" ${mode==='online'?'disabled':''}>⇧ <span>IMPORT PGN</span></button><button class="tool-button" id="copy-fen">◇ <span>COPY FEN</span></button><button class="tool-button" id="custom-fen" ${mode==='online'?'disabled':''}>▦ <span>SET FEN</span></button><button class="tool-button" id="claim-draw" ${isGameFinished()?'disabled':''}>½ <span>CLAIM DRAW</span></button><button class="tool-button" id="offer-draw" ${mode==='computer' || mode==='puzzle' || isGameFinished()?'disabled':''}>🤝 <span>OFFER DRAW</span></button><button class="tool-button" id="resign-game" ${mode==='puzzle' || isGameFinished()?'disabled':''}>⚑ <span>RESIGN</span></button><button class="tool-button haptics-button ${hapticsEnabled?'is-on':''}" id="toggle-haptics" aria-pressed="${hapticsEnabled}">◈ <span>HAPTICS ${hapticsEnabled?'ON':'OFF'}</span></button><button class="tool-button ${soundEnabled?'is-on':''}" id="toggle-sound" aria-pressed="${soundEnabled}">♪ <span>SOUND ${soundEnabled?'ON':'OFF'}</span></button><button class="tool-button ${animationsEnabled?'is-on':''}" id="toggle-animations" aria-pressed="${animationsEnabled}">✦ <span>MOTION ${animationsEnabled?'ON':'OFF'}</span></button></div>
            <small class="haptics-note">${typeof navigator.vibrate === 'function' ? 'Haptics available · use the button to test your device.' : 'This device exposes no vibration API. Physical haptics require a supported phone with a vibration motor.'}</small>
          </section>
          <aside class="game-sidebar">
            <div class="sidebar-panel match-status-panel"><div class="panel-heading"><span class="section-kicker">MATCH STATUS</span><span class="live-dot"></span></div><div class="status-large">${finished?'Match complete':thinking?'Calculating…':game.isCheck()?'King in danger': 'In progress'}</div><p>${escapeHTML(statusText())}</p>${finished?'<button class="primary-button rematch-button" id="rematch">Play again <span>↗</span></button>':''}</div>
            <div class="sidebar-panel"><div class="panel-heading"><span class="section-kicker">MOVE HISTORY</span><span class="move-count">${game.history().length} PLY</span></div><div class="move-history" id="move-history">${renderMoveList()}</div></div>
            <div class="sidebar-panel captured-panel"><div class="panel-heading"><span class="section-kicker">CAPTURED PIECES</span></div><div class="captured-line"><span>WHITE</span><strong>${captured.capturedByWhite.join(' ')||'—'}</strong></div><div class="captured-line"><span>BLACK</span><strong>${captured.capturedByBlack.join(' ')||'—'}</strong></div></div>
            <div class="engine-card"><div class="engine-icon">✦</div><div><strong>${mode==='computer'?currentDifficulty().name+' Engine':'Local two-player'}</strong><p>${mode==='computer'?'Stockfish-powered when engine files are installed.':'Pass the device after each move.'}</p></div></div>
            ${engineNotice?`<div class="engine-warning">${escapeHTML(engineNotice)}</div>`:''}
            ${mode==='online' && onlineSession ? `<div class="sidebar-panel online-room-panel"><div class="panel-heading"><span class="section-kicker">PRIVATE ROOM</span></div><strong>${escapeHTML(onlineSession.code)}</strong><button class="text-link" id="copy-room-code">Copy invitation code</button><small>${onlineSession.waiting ? 'Waiting for second player…' : onlineSession.drawOfferBy ? 'Draw offer pending.' : 'Connected to opponent.'}</small></div>`:''}
            ${mode==='puzzle' && puzzleSession ? `<div class="sidebar-panel"><div class="panel-heading"><span class="section-kicker">PUZZLE</span></div><strong>${escapeHTML(puzzleSession.title)}</strong><p>${escapeHTML(puzzleSession.description)}</p></div>`:''}
            ${finished ? `<button class="secondary-button" id="analyze-game">Analyse game with Stockfish</button>`:''}
            <div class="sidebar-bottom"><span>WORLD SELECTED</span><strong>${escapeHTML(theme.name)}</strong><button id="change-theme" class="text-link">Change realm ↗</button></div>
          </aside>
        </div>
      </main>
      ${game.isCheckmate() ? `<div class="checkmate-screen" id="checkmate-screen" role="dialog" aria-modal="true" aria-labelledby="checkmate-title"><div class="checkmate-card"><span class="checkmate-eyebrow">THE FINAL MOVE</span><div class="checkmate-emblem" aria-hidden="true">♛</div><h2 id="checkmate-title">CHECKMATE</h2><p class="checkmate-winner">${game.turn()==='w'?'BLACK':'WHITE'} WINS</p><p class="checkmate-copy">The king has no legal escape. This match is complete.</p><div class="checkmate-actions"><button class="primary-button" id="checkmate-rematch">${mode==='online'?'NEW ROOM':'PLAY AGAIN'} <span>↗</span></button><button class="secondary-button" id="checkmate-menu">RETURN TO REALMS</button><button class="checkmate-dismiss" id="checkmate-dismiss">View final position</button></div></div></div>` : ''}
      <footer class="site-footer"><span>ROYAL REALMS <i>CHESS</i></span><span>THINK DEEPLY. MOVE BEAUTIFULLY.</span><span>© 2026</span></footer>
    </div>`;

  const boardElement = document.querySelector('#chess-board');
  try {
    const moveAnimation = lastMove?.animate && animationsEnabled ? lastMove : null;
    const position = {
      board: game.board(), orientation, theme, selectedSquare,
      legalTargets: legalTargets.map(move => move.to),
      checkedSquare: checkedKingSquare(), checkmate: game.isCheckmate(), lastMove: moveAnimation, woodFinish
    };
    if (active3DBoard) {
      active3DBoard.attach(boardElement);
      active3DBoard.animationsEnabled = animationsEnabled;
      active3DBoard.updatePosition(position);
    } else {
      active3DBoard = new ThreeChessboard(boardElement, {
        ...position, onSquareClick: squareClick, onSquareDrop: squareDrop,
        animationsEnabled
      });
    }
    boardElement.dataset.renderer = 'three';
    if (lastMove) lastMove.animate = false;
    updateClockLabels();
  } catch (error) {
    const detail = error?.message || String(error);
    window.__ROYAL_REALMS_3D_ERROR__ = detail;
    console.error('Royal Realms 3D renderer failed; entered clearly-labelled 2D safe mode.', error);
    active3DBoard?.destroy();
    active3DBoard = null;
    boardElement.classList.remove('three-board-host');
    const modeMark = document.querySelector('#renderer-mode-mark');
    if (modeMark) { modeMark.textContent = '2D SAFE MODE · WEBGL BLOCKED'; modeMark.classList.add('is-fallback'); }
    boardElement.insertAdjacentHTML('beforebegin', `<div class="renderer-diagnostic" role="status"><strong>3D renderer unavailable — 2D safe mode</strong><span>${escapeHTML(detail)}</span><small>On Kali/Chrome, open chrome://gpu and check WebGL 2. If hardware acceleration is disabled, enable it in Chrome Settings → System and relaunch.</small></div>`);
    boardElement.innerHTML = renderBoard();
    boardElement.addEventListener('click', event => {
      const squareButton = event.target.closest('.board-square');
      if (squareButton && boardElement.contains(squareButton)) squareClick(squareButton.dataset.square);
    });
    showToast('3D rendering is unavailable in this browser. Switched to the 2D board.', 'warning');
  }
  document.querySelector('#back-setup').addEventListener('click', renderSetup);
  document.querySelector('#flip-board').addEventListener('click', () => { orientation = orientation==='w'?'b':'w'; persistGame(); renderGame(); });
  document.querySelector('#hint-move')?.addEventListener('click', async event => {
    if (mode === 'online' || mode === 'puzzle') return showToast('Coach hints are disabled in competitive rooms and scored puzzles.', 'warning');
    if (thinking || isGameFinished()) return;
    const button = event.currentTarget;
    button.disabled = true;
    const original = button.innerHTML;
    button.textContent = 'COACH THINKING…';
    try {
      const generation = gameGeneration;
      const hintFen = game.fen();
      const uci = await engine.getMove(hintFen, difficulty, 'royal-master');
      if (generation !== gameGeneration || game.fen() !== hintFen || !uci) return;
      const recommendation = game.moves({ verbose:true }).find(move => `${move.from}${move.to}${move.promotion || ''}` === uci);
      if (!recommendation) throw new Error('The engine did not return a legal hint for this position.');
      selectedSquare = recommendation.from;
      legalTargets = game.moves({ square:recommendation.from, verbose:true });
      refreshSelection();
      showToast(`Royal Coach suggests ${recommendation.san}. Highlighted on the board.`, 'success');
    } catch (error) {
      showToast(`Coach hint unavailable: ${error.message}`, 'warning');
    } finally {
      const current = document.querySelector('#hint-move');
      if (current) { current.disabled = mode === 'online' || mode === 'puzzle'; current.innerHTML = original; }
    }
  });
  document.querySelector('#zoom-in')?.addEventListener('click', () => active3DBoard ? active3DBoard.zoomBy(.88) : showToast('Camera zoom requires WebGL.', 'warning'));
  document.querySelector('#zoom-out')?.addEventListener('click', () => active3DBoard ? active3DBoard.zoomBy(1.14) : showToast('Camera zoom requires WebGL.', 'warning'));
  document.querySelector('#rotate-view-left')?.addEventListener('click', () => active3DBoard ? active3DBoard.rotateCamera(-Math.PI / 12) : showToast('Camera rotation requires WebGL.', 'warning'));
  document.querySelector('#rotate-view-right')?.addEventListener('click', () => active3DBoard ? active3DBoard.rotateCamera(Math.PI / 12) : showToast('Camera rotation requires WebGL.', 'warning'));
  document.querySelector('#reset-camera')?.addEventListener('click', () => active3DBoard ? active3DBoard.resetCamera() : showToast('Camera controls require WebGL.', 'warning'));
  document.querySelector('#board-fullscreen')?.addEventListener('click', async () => {
    const frame = document.querySelector('#board-frame');
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await frame?.requestFullscreen?.();
    } catch { showToast('Fullscreen is unavailable in this browser.', 'warning'); }
  });
  document.querySelector('#undo-move').addEventListener('click', undoMove);
  document.querySelector('#restart-game').addEventListener('click', restartGame);
  document.querySelector('#save-pgn').addEventListener('click', exportPGN);
  document.querySelector('#redo-move')?.addEventListener('click', redoMove);
  document.querySelector('#import-pgn')?.addEventListener('click', importPGN);
  document.querySelector('#copy-fen')?.addEventListener('click', copyFEN);
  document.querySelector('#custom-fen')?.addEventListener('click', setupCustomPosition);
  document.querySelector('#claim-draw')?.addEventListener('click', claimDraw);
  document.querySelector('#offer-draw')?.addEventListener('click', offerDraw);
  document.querySelector('#resign-game')?.addEventListener('click', resignGame);
  document.querySelector('#analyze-game')?.addEventListener('click', renderAnalysisPage);
  document.querySelector('#copy-room-code')?.addEventListener('click', () => { const code=onlineSession?.code||''; if(navigator.clipboard?.writeText) navigator.clipboard.writeText(code).then(()=>showToast('Room code copied.')).catch(()=>prompt('Copy room code:',code)); else prompt('Copy room code:',code); });
  document.querySelector('#toggle-haptics').addEventListener('click', () => {
    hapticsEnabled = !hapticsEnabled;
    savePrefs();
    renderGame();
    if (!hapticsEnabled) {
      try { navigator.vibrate?.(0); } catch { /* Unsupported device. */ }
      showToast('Haptic alerts disabled.');
    } else {
      const sent = sendHaptic('test');
      showToast(sent ? 'Haptic test sent. Check your device vibration settings.' : 'This browser/device did not confirm vibration. Test on a supported Android phone in Chrome.', sent ? '' : 'warning');
    }
  });
  document.querySelector('#toggle-sound').addEventListener('click', () => {
    soundEnabled = !soundEnabled; savePrefs(); renderGame();
    showToast(soundEnabled ? 'Move sounds enabled.' : 'Move sounds muted.');
  });
  document.querySelector('#toggle-animations').addEventListener('click', () => {
    animationsEnabled = !animationsEnabled; savePrefs();
    lastMove = lastMove ? { ...lastMove, animate:false } : null;
    renderGame();
    showToast(animationsEnabled ? 'Move animations enabled.' : 'Move animations reduced.');
  });
  document.querySelector('#change-theme').addEventListener('click', renderSetup);
  document.querySelector('#rematch')?.addEventListener('click', () => mode === 'online' ? renderOnlineLobby() : restartGame());
  document.querySelector('#checkmate-rematch')?.addEventListener('click', () => mode === 'online' ? renderOnlineLobby() : restartGame());
  document.querySelector('#checkmate-menu')?.addEventListener('click', renderSetup);
  document.querySelector('#checkmate-dismiss')?.addEventListener('click', () => document.querySelector('#checkmate-screen')?.remove());
  document.querySelector('#game-install')?.addEventListener('click', installApp);
  const historyBox = document.querySelector('#move-history');
  if (historyBox) historyBox.scrollTop = historyBox.scrollHeight;
  syncInstallButton();
}

function undoMove() {
  if (mode === 'online') return showToast('Undo is disabled in online matches.', 'warning');
  if (thinking || Date.now() < animationLockUntil || !game.history().length) return;
  animationLockUntil = 0;
  const count = mode === 'computer' ? Math.min(2, game.history().length) : 1;
  const undone = [];
  for (let i = 0; i < count; i++) {
    const move = game.undo();
    const snapshot = clockSnapshots.pop() || null;
    if (move) undone.unshift({ from:move.from, to:move.to, promotion:move.promotion || undefined, clockAfter:snapshot });
  }
  redoStack = [...undone, ...redoStack];
  if (clockSnapshots.length) clockRemaining = { ...clockSnapshots.at(-1) };
  clockLastTick = performance.now();
  gameResult = null; drawOfferBy = null;
  const history = game.history({ verbose:true });
  lastMove = history.length ? { from:history.at(-1).from, to:history.at(-1).to, animate:false } : null;
  selectedSquare = null; legalTargets = [];
  persistGame(); renderGame();
}

function redoMove() {
  if (mode === 'online' || thinking || !redoStack.length || isGameFinished()) return;
  const count = mode === 'computer' ? Math.min(2, redoStack.length) : 1;
  let applied = 0;
  for (let i = 0; i < count; i++) {
    const move = redoStack[0];
    try {
      const result = game.move({ from:move.from, to:move.to, promotion:move.promotion || 'q' });
      redoStack.shift();
      if (result) {
        clockRemaining = { ...(move.clockAfter || clockRemaining) };
        clockSnapshots.push({ ...clockRemaining });
        lastMove = { from:result.from, to:result.to, piece:result.piece, color:result.color, captured:result.captured || null, promotion:result.promotion || null, san:result.san, animate:false };
        applied++;
      }
    } catch { redoStack = []; break; }
  }
  if (applied) {
    clockLastTick = performance.now();
    persistGame(); renderGame();
    if (mode === 'computer' && game.turn() !== humanColor && !game.isGameOver()) computerTurn();
  }
}

function restartGame() {
  if (mode === 'online') return showToast('Online rooms cannot be restarted by one player. Create a new private room.', 'warning');
  if (mode === 'puzzle' && puzzleSession) return startPuzzle(puzzleSession.id);
  animationLockUntil = 0;
  gameGeneration++;
  engine.stop();
  game = new Chess();
  gameResult = null; drawOfferBy = null; puzzleSession = null; redoStack = []; clockSnapshots = [];
  initGameClock();
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


function getWoodNoiseBuffer(ctx) {
  if (sharedNoiseBuffer && sharedNoiseBuffer.sampleRate === ctx.sampleRate) return sharedNoiseBuffer;
  const length = Math.floor(ctx.sampleRate * .16);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    const decay = Math.exp(-i / (ctx.sampleRate * .028));
    data[i] = (Math.random() * 2 - 1) * decay;
  }
  sharedNoiseBuffer = buffer;
  return buffer;
}

function playSynthWoodSound(move) {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const capture = Boolean(move?.captured);
    const noise = ctx.createBufferSource();
    noise.buffer = getWoodNoiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(capture ? 720 : 1050, now);
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(.0001, now);
    noiseGain.gain.exponentialRampToValueAtTime(capture ? .16 : .105, now + .004);
    noiseGain.gain.exponentialRampToValueAtTime(.0001, now + (capture ? .13 : .085));
    noise.connect(filter); filter.connect(noiseGain); noiseGain.connect(ctx.destination);
    noise.start(now); noise.stop(now + .16);

    const body = ctx.createOscillator();
    const bodyGain = ctx.createGain();
    body.type = 'sine';
    body.frequency.setValueAtTime(capture ? 118 : 168, now);
    body.frequency.exponentialRampToValueAtTime(capture ? 62 : 92, now + .105);
    bodyGain.gain.setValueAtTime(.0001, now);
    bodyGain.gain.exponentialRampToValueAtTime(capture ? .12 : .075, now + .006);
    bodyGain.gain.exponentialRampToValueAtTime(.0001, now + .14);
    body.connect(bodyGain); bodyGain.connect(ctx.destination);
    body.start(now); body.stop(now + .15);

    if (capture) {
      const tick = ctx.createOscillator();
      const tickGain = ctx.createGain();
      tick.type = 'triangle';
      tick.frequency.setValueAtTime(480, now + .025);
      tickGain.gain.setValueAtTime(.0001, now + .025);
      tickGain.gain.exponentialRampToValueAtTime(.025, now + .03);
      tickGain.gain.exponentialRampToValueAtTime(.0001, now + .075);
      tick.connect(tickGain); tickGain.connect(ctx.destination);
      tick.start(now + .025); tick.stop(now + .08);
    }
  } catch { /* Audio is optional where browser audio is unavailable. */ }
}

function playMoveSound(move) {
  if (!soundEnabled) return;
  const kind = move?.captured ? 'capture' : 'move';
  try {
    let base = woodAudioSamples.get(kind);
    if (!base) {
      base = new Audio(`/audio/wood-${kind}.wav`);
      base.preload = 'auto';
      base.load();
      woodAudioSamples.set(kind, base);
    }
    const sample = base.cloneNode();
    sample.volume = kind === 'capture' ? .82 : .72;
    sample.playbackRate = kind === 'capture' ? .96 : 1.02;
    const playback = sample.play();
    if (playback?.catch) playback.catch(() => playSynthWoodSound(move));
  } catch {
    playSynthWoodSound(move);
  }
}

function playCheckSound() {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [520, 390].forEach((frequency, index) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = now + index * .13;
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(frequency, start);
      oscillator.frequency.exponentialRampToValueAtTime(frequency * .82, start + .23);
      gain.gain.setValueAtTime(.0001, start);
      gain.gain.exponentialRampToValueAtTime(.038, start + .025);
      gain.gain.exponentialRampToValueAtTime(.0001, start + .28);
      oscillator.connect(gain); gain.connect(ctx.destination);
      oscillator.start(start); oscillator.stop(start + .29);
    });
  } catch { /* Haptics and visual warning still work without Web Audio. */ }
}

function sendHaptic(kind = 'check') {
  if (!hapticsEnabled || typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return false;
  const patterns = {
    test: 90,
    check: [105, 55, 145],
    mate: [180, 75, 180]
  };
  try { return navigator.vibrate(patterns[kind] || patterns.check) === true; }
  catch { return false; }
}

function playMoveEffects(move) {
  playMoveSound(move);
  if (game.isCheckmate()) {
    showToast('CHECKMATE — the match is complete.', 'mate');
    playCheckSound();
    sendHaptic('mate');
    return;
  }
  if (game.isCheck()) announceCheck();
}

function announceCheck() {
  playCheckSound();
  sendHaptic('check');
}

function isGameFinished() { return Boolean(gameResult) || game.isGameOver(); }

function getTimeConfig(id = timeControlId) {
  const [minutes = '10', increment = '0'] = String(id).split('+');
  const base = Math.max(1, Number(minutes) || 10) * 60_000;
  const inc = Math.max(0, Number(increment) || 0) * 1000;
  return { initial:{ w:base, b:base }, increment:inc };
}

function formatClock(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
}

function initGameClock() {
  stopClock();
  const config = getTimeConfig();
  clockRemaining = { ...config.initial };
  clockIncrementMs = config.increment;
  clockSnapshots = [{ ...clockRemaining }];
  clockStarted = true;
  clockLastTick = performance.now();
  startClock();
}

function startClock() {
  if (clockInterval) clearInterval(clockInterval);
  clockStarted = true;
  clockLastTick = performance.now();
  clockInterval = window.setInterval(clockTick, 200);
}

function stopClock() {
  if (clockInterval) clearInterval(clockInterval);
  clockInterval = null;
  clockStarted = false;
}

function clockTick() {
  if (!clockStarted || screen !== 'game' || isGameFinished() || mode === 'puzzle') return;
  const now = performance.now();
  const elapsed = Math.max(0, now - clockLastTick);
  clockLastTick = now;
  const side = mode === 'online' ? (onlineSession?.serverTurn || game.turn()) : game.turn();
  clockRemaining[side] = Math.max(0, clockRemaining[side] - elapsed);
  updateClockLabels();
  if (clockRemaining[side] <= 0) endOnTime(side);
}

function settleClockForMove() {
  if (!clockStarted || mode === 'puzzle' || mode === 'online') return true;
  const now = performance.now();
  const side = game.turn();
  clockRemaining[side] = Math.max(0, clockRemaining[side] - Math.max(0, now - clockLastTick));
  clockLastTick = now;
  if (clockRemaining[side] <= 0) { endOnTime(side); return false; }
  return true;
}

function completeClockMove(mover) {
  if (mode === 'puzzle' || mode === 'online') return;
  clockRemaining[mover] += clockIncrementMs;
  clockLastTick = performance.now();
  clockSnapshots.push({ ...clockRemaining });
}

function updateClockLabels() {
  const white = document.querySelector('#white-clock');
  const black = document.querySelector('#black-clock');
  if (white) white.textContent = formatClock(clockRemaining.w);
  if (black) black.textContent = formatClock(clockRemaining.b);
  white?.classList.toggle('clock-low', clockRemaining.w < 30_000);
  black?.classList.toggle('clock-low', clockRemaining.b < 30_000);
}

function endOnTime(flaggedSide) {
  if (isGameFinished()) return;
  stopClock();
  if (game.isInsufficientMaterial()) {
    finishGame({ type:'draw', text:'Draw on time — the opponent has insufficient mating material.' });
  } else {
    const winner = flaggedSide === 'w' ? 'b' : 'w';
    finishGame({ type:'timeout', winner, text:`${winner === 'w' ? 'White' : 'Black'} wins on time.` });
  }
}

function finishGame(result) {
  if (gameResult) return;
  gameResult = result;
  stopClock();
  const resultKey = `${game.pgn()}|${result.type}|${result.text}`;
  const history = readJSON(FINISHED_KEY, []);
  if (!history.some(item => item.key === resultKey)) {
    history.unshift({ key:resultKey, pgn:game.pgn(), fen:game.fen(), result, mode, themeId, finishedAt:Date.now(), moves:game.history().length });
    localStorage.setItem(FINISHED_KEY, JSON.stringify(history.slice(0,100)));
    void dbPut('games', `finished-${Date.now()}`, history[0]);
    updateLocalStats(result);
  }
  persistGame();
  renderGame();
}

function updateLocalStats(result) {
  localStats.games = (localStats.games || 0) + 1;
  if (mode === 'friend') {
    // A pass-and-play result belongs to two people sharing one device, so do
    // not attribute a win/loss to the saved single-player profile.
    localStats.localDuels = (localStats.localDuels || 0) + 1;
  } else if (result.type === 'draw') {
    localStats.draws = (localStats.draws || 0) + 1;
    localStats.streak = 0;
  } else {
    const humanWon = result.winner === humanColor;
    if (humanWon) { localStats.wins = (localStats.wins || 0) + 1; localStats.streak = (localStats.streak || 0) + 1; }
    else { localStats.losses = (localStats.losses || 0) + 1; localStats.streak = 0; }
    localStats.bestStreak = Math.max(localStats.bestStreak || 0, localStats.streak || 0);
  }
  const earned = new Set(localStats.achievements || []);
  if (localStats.wins >= 1) earned.add('First Victory');
  if (game.isCheckmate()) earned.add('First Checkmate');
  if (localStats.wins >= 10) earned.add('Ten Wins');
  if (localStats.games >= 50) earned.add('Fifty Games');
  if (localStats.bestStreak >= 5) earned.add('Winning Streak');
  localStats.achievements = [...earned];
  localStorage.setItem(STATS_KEY, JSON.stringify(localStats));
  void dbPut('stats', 'local', localStats);
}

function finishIfRulesEnded() {
  if (game.isCheckmate()) finishGame({ type:'checkmate', winner:game.turn()==='w'?'b':'w', text:`Checkmate — ${game.turn()==='w'?'Black':'White'} wins.` });
  else if (game.isStalemate()) finishGame({ type:'draw', text:'Draw — stalemate.' });
  else if (game.isInsufficientMaterial()) finishGame({ type:'draw', text:'Draw — insufficient material.' });
  else if (game.isGameOver()) finishGame({ type:'draw', text:'Draw — automatic fivefold-repetition or seventy-five-move rule.' });
}

function claimDraw() {
  if (mode === 'online') return onlineAction('claim-draw');
  if (isGameFinished()) return showToast('The game has already ended.', 'warning');
  const fiftyMoveClaim = typeof game.isDrawByFiftyMoves === 'function' ? game.isDrawByFiftyMoves() : false;
  if (game.isThreefoldRepetition()) return finishGame({ type:'draw', text:'Draw claimed — threefold repetition.' });
  if (fiftyMoveClaim) return finishGame({ type:'draw', text:'Draw claimed — fifty-move rule.' });
  showToast('No draw claim is currently available.', 'warning');
}

function offerDraw() {
  if (mode === 'online') return onlineAction('draw');
  if (mode !== 'friend') return showToast('Draw offers are available in friend or online matches.', 'warning');
  const offerer = game.turn() === 'w' ? 'White' : 'Black';
  drawOfferBy = game.turn();
  if (confirm(`${offerer} offers a draw. Accept?`)) finishGame({ type:'draw', text:'Draw agreed by both players.' });
  else { drawOfferBy = null; showToast('Draw offer declined.'); }
}

function resignGame() {
  if (isGameFinished()) return;
  if (mode === 'online') { if (confirm('Resign this online match?')) return onlineAction('resign'); return; }
  if (!confirm('Resign this game?')) return;
  const resigningSide = mode === 'computer' ? humanColor : game.turn();
  const winner = resigningSide === 'w' ? 'b' : 'w';
  finishGame({ type:'resignation', winner, text:`${winner === 'w'?'White':'Black'} wins by resignation.` });
}

function importPGN() {
  const text = prompt('Paste a PGN game:');
  if (!text?.trim()) return;
  try {
    const imported = new Chess();
    imported.loadPgn(text);
    stopClock(); game = imported; gameResult = null; drawOfferBy = null; redoStack = []; puzzleSession = null;
    lastMove = game.history({ verbose:true }).at(-1) || null;
    if (lastMove) lastMove = { from:lastMove.from, to:lastMove.to, animate:false };
    clockSnapshots = Array.from({ length:game.history().length + 1 }, () => ({ ...clockRemaining })); startClock(); persistGame(); renderGame();
    showToast('PGN imported successfully.');
  } catch (error) { showToast(`PGN import failed: ${error.message}`, 'warning'); }
}

function copyFEN() {
  const text = game.fen();
  navigator.clipboard?.writeText(text).then(() => showToast('FEN copied to clipboard.')).catch(() => prompt('Copy this FEN:', text));
}

function setupCustomPosition() {
  const fen = prompt('Paste a valid FEN position:');
  if (!fen?.trim()) return;
  try {
    const custom = new Chess(fen.trim());
    game = custom; mode = 'friend'; puzzleSession = null; gameResult = null; redoStack = [];
    lastMove = null; selectedSquare = null; legalTargets = [];
    initGameClock(); screen = 'game'; renderGame();
    showToast('Custom position loaded.');
  } catch (error) { showToast(`Invalid FEN: ${error.message}`, 'warning'); }
}

function openDashboardPage(page) {
  if (page === 'play') return renderSetup();
  if (page === 'puzzles') return renderPuzzlesPage();
  if (page === 'openings') return renderOpeningsPage();
  if (page === 'games') return renderMyGamesPage();
  if (page === 'profile') return renderProfilePage();
  if (page === 'settings') return renderSettingsPage();
}

function renderPageShell(title, subtitle, content) {
  setup3DBoard?.destroy(); setup3DBoard = null;
  active3DBoard?.destroy(); active3DBoard = null;
  app.innerHTML = `<div class="site-shell feature-shell"><header class="topbar"><button class="back-button" id="feature-back">← <span>BACK TO REALMS</span></button><a class="brand compact-brand" href="#"><span class="brand-emblem">♔</span><span>ROYAL <i>REALMS</i><small>THE ART OF STRATEGY</small></span></a><span class="offline-indicator"><i></i> LOCAL DATA</span></header><main class="feature-main"><div class="section-kicker">ROYAL REALMS / PLAYER CENTRE</div><h1>${escapeHTML(title)}</h1><p class="feature-subtitle">${escapeHTML(subtitle)}</p>${content}</main><footer class="site-footer"><span>ROYAL REALMS <i>CHESS</i></span><span>YOUR GAMES. YOUR PROGRESS.</span><span>© 2026</span></footer></div>`;
  document.querySelector('#feature-back')?.addEventListener('click', renderSetup);
}

function renderPuzzlesPage() {
  const cards = puzzles.map(p => `<article class="feature-card puzzle-card"><div class="feature-card-top"><span class="feature-tag">${escapeHTML(p.theme)}</span><span class="rating-tag">${p.rating} rating</span></div><h3>${escapeHTML(p.title)}</h3><p>${escapeHTML(p.description)}</p><button class="secondary-button" data-puzzle="${p.id}">Solve puzzle ↗</button></article>`).join('');
  renderPageShell('Puzzle Lab', 'Solve verified legal positions and practise tactical patterns. New puzzle collections can be added without changing the chess rules engine.', `<div class="feature-grid">${cards}</div><p class="feature-footnote">The included starter set contains two checkmate exercises. The broader daily/tactical catalogue is not yet populated.</p>`);
  document.querySelectorAll('[data-puzzle]').forEach(button => button.addEventListener('click', () => startPuzzle(button.dataset.puzzle)));
}

function startPuzzle(id) {
  const puzzle = puzzles.find(item => item.id === id);
  if (!puzzle) return;
  try {
    const next = new Chess();
    for (const san of puzzle.prefix) next.move(san);
    game = next; mode = 'puzzle'; humanColor = puzzle.side;
    puzzleSession = { id:puzzle.id, title:puzzle.title, description:puzzle.description, solution:[...puzzle.solution], index:0, side:puzzle.side, solved:false };
    gameResult = null; drawOfferBy = null; redoStack = []; clockSnapshots = [];
    stopClock(); clockRemaining = { w:0, b:0 }; clockIncrementMs = 0;
    orientation = puzzle.side; lastMove = null; selectedSquare = null; legalTargets = [];
    screen = 'game'; renderGame();
  } catch (error) { showToast(`Puzzle data failed validation: ${error.message}`, 'warning'); }
}

function renderOpeningsPage() {
  const cards = openings.map(item => `<article class="feature-card"><span class="feature-tag">${escapeHTML(item.family)}</span><h3>${escapeHTML(item.name)}</h3><p>${escapeHTML(item.idea)}</p><button class="secondary-button" data-opening="${item.id}">Study opening ↗</button></article>`).join('');
  renderPageShell('Opening Academy', 'Explore validated opening lines with move-by-move explanations. Every line is replayed through chess.js before it is shown.', `<div class="feature-grid">${cards}</div><div id="opening-viewer" class="opening-viewer" hidden></div>`);
  document.querySelectorAll('[data-opening]').forEach(button => button.addEventListener('click', () => openOpening(button.dataset.opening)));
}

function renderSimpleBoard(chess) {
  const board = chess.board();
  const glyph = { w:{k:'♔',q:'♕',r:'♖',b:'♗',n:'♘',p:'♙'}, b:{k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟︎'} };
  return `<div class="lesson-board">${board.flatMap((row,r)=>row.map((piece,c)=>`<div class="lesson-square ${(r+c)%2?'dark':'light'}">${piece?glyph[piece.color][piece.type]:''}</div>`)).join('')}</div>`;
}

function openOpening(id) {
  const opening = openings.find(item => item.id === id);
  if (!opening) return;
  const demo = new Chess();
  const viewer = document.querySelector('#opening-viewer');
  const render = () => {
    viewer.hidden = false;
    viewer.innerHTML = `<div class="opening-view-head"><div><span class="section-kicker">LESSON ${opening.moves.length ? Math.min(openingDemo.index, opening.moves.length) : 0} / ${opening.moves.length}</span><h2>${escapeHTML(opening.name)}</h2><p>${escapeHTML(opening.idea)}</p></div></div>${renderSimpleBoard(openingDemo.game)}<p class="opening-next">${openingDemo.index < opening.moves.length ? `Next move: <strong>${escapeHTML(opening.moves[openingDemo.index])}</strong>` : 'Opening line complete.'}</p><div class="feature-actions"><button class="secondary-button" id="opening-prev" ${openingDemo.index===0?'disabled':''}>← Previous</button><button class="primary-button" id="opening-next" ${openingDemo.index>=opening.moves.length?'disabled':''}>Next move →</button><button class="secondary-button" id="opening-reset">Reset line</button></div><div class="move-history lesson-history">${openingDemo.game.history().join(' · ') || 'Starting position'}</div>`;
    document.querySelector('#opening-prev')?.addEventListener('click', () => { if(openingDemo.index>0){openingDemo.index--; openingDemo.game.undo(); render();} });
    document.querySelector('#opening-next')?.addEventListener('click', () => { if(openingDemo.index<opening.moves.length){openingDemo.game.move(opening.moves[openingDemo.index]); openingDemo.index++; render();} });
    document.querySelector('#opening-reset')?.addEventListener('click', () => { openingDemo.game = new Chess(); openingDemo.index=0; render(); });
  };
  openingDemo = { game:demo, index:0, opening };
  try { const validator = new Chess(); for(const move of opening.moves) validator.move(move); }
  catch(error) { showToast(`Opening line is not legal: ${error.message}`, 'warning'); return; }
  render();
}

function renderMyGamesPage() {
  const history = readJSON(FINISHED_KEY, []);
  const active = savedGame();
  const cards = history.map((item,index) => `<article class="feature-card"><span class="feature-tag">${new Date(item.finishedAt).toLocaleString()}</span><h3>${escapeHTML(item.result?.text || 'Completed game')}</h3><p>${item.moves || 0} half-moves · ${escapeHTML(item.mode || 'local')} · ${escapeHTML(item.themeId || 'theme')}</p><button class="secondary-button" data-replay="${index}">Review PGN ↗</button></article>`).join('');
  renderPageShell('My Games', 'Completed matches are stored locally on this device. Unfinished games can be resumed from the Play screen.', `${active?'<div class="feature-card active-save"><span class="feature-tag">UNFINISHED</span><h3>Saved match available</h3><p>Continue from your last saved FEN and PGN.</p><button class="primary-button" id="resume-from-history">Resume game ↗</button></div>':''}<div class="feature-grid">${cards || '<div class="empty-history"><p>No completed games saved yet.</p></div>'}</div>`);
  document.querySelector('#resume-from-history')?.addEventListener('click', resumeGame);
  document.querySelectorAll('[data-replay]').forEach(button => button.addEventListener('click', () => {
    const item = history[Number(button.dataset.replay)];
    if (!item?.pgn) return;
    try { game = new Chess(); game.loadPgn(item.pgn); mode='friend'; gameResult=item.result || null; puzzleSession=null; lastMove=null; screen='game'; initGameClock(); if (gameResult) stopClock(); renderGame(); } catch(error) { showToast(`Could not replay this PGN: ${error.message}`, 'warning'); }
  }));
}

function renderProfilePage() {
  const achievements = ['First Victory','First Checkmate','Ten Wins','Fifty Games','Winning Streak','Puzzle Master','Opening Explorer'];
  const cards = achievements.map(name => `<div class="achievement ${localStats.achievements?.includes(name)?'earned':''}"><span>${localStats.achievements?.includes(name)?'✦':'◇'}</span><strong>${name}</strong><small>${localStats.achievements?.includes(name)?'Unlocked':'Not yet unlocked'}</small></div>`).join('');
  renderPageShell('Player Profile', 'Local statistics are based only on games recorded on this device. No online rating is shown until rated multiplayer is implemented.', `<div class="profile-summary feature-card"><label>DISPLAY NAME<input id="profile-name-edit" maxlength="24" value="${escapeHTML(profileData.name || 'Player One')}"></label><button class="primary-button" id="save-profile">Save profile</button></div><div class="stats-grid"><div><strong>${localStats.games||0}</strong><small>GAMES</small></div><div><strong>${localStats.wins||0}</strong><small>WINS</small></div><div><strong>${localStats.draws||0}</strong><small>DRAWS</small></div><div><strong>${localStats.losses||0}</strong><small>LOSSES</small></div><div><strong>${localStats.bestStreak||0}</strong><small>BEST STREAK</small></div><div><strong>${localStats.localDuels||0}</strong><small>LOCAL DUELS</small></div></div><h2 class="feature-section-title">Achievements</h2><div class="achievement-grid">${cards}</div>`);
  document.querySelector('#save-profile')?.addEventListener('click', () => { profileData.name = document.querySelector('#profile-name-edit').value.trim().slice(0,24) || 'Player One'; localStorage.setItem(PROFILE_KEY, JSON.stringify(profileData)); void dbPut('stats','profile',profileData); showToast('Profile saved on this device.'); });
}

function renderSettingsPage() {
  renderPageShell('Game Settings', 'Personalize your board and feedback. Settings are saved locally.', `<div class="settings-panel feature-card"><label><input type="checkbox" id="setting-sound" ${soundEnabled?'checked':''}> Move and capture sounds</label><label><input type="checkbox" id="setting-motion" ${animationsEnabled?'checked':''}> Animations (respects reduced-motion preference)</label><label><input type="checkbox" id="setting-haptics" ${hapticsEnabled?'checked':''}> Haptic requests on supported phones</label><label>Board realm<select id="setting-theme">${themes.map(t=>`<option value="${t.id}" ${themeId===t.id?'selected':''}>${escapeHTML(t.name)}</option>`).join('')}</select></label><label>Physical 3D wood finish<select id="setting-wood-finish">${[['heritage','Heritage Oak & Walnut'],['walnut','Deep Walnut'],['oak','Natural Golden Oak'],['ebony','Ebony & Ivory'],['cherry','Cherrywood']].map(([v,n])=>`<option value="${v}" ${woodFinish===v?'selected':''}>${n}</option>`).join('')}</select><small>Changes the real Three.js board, frame, table and piece materials.</small></label><label>Time control<select id="setting-time">${['1+0','2+1','3+0','3+2','5+0','10+0','15+10','30+0'].map(t=>`<option value="${t}" ${timeControlId===t?'selected':''}>${t}</option>`).join('')}</select></label><label>AI personality<select id="setting-personality">${[['royal-master','Royal Master'],['aggressor','The Aggressor'],['guardian','The Guardian'],['strategist','The Strategist'],['gambler','The Gambler']].map(([v,n])=>`<option value="${v}" ${personality===v?'selected':''}>${n}</option>`).join('')}</select></label><button class="primary-button" id="save-settings">Save settings</button></div>`);
  document.querySelector('#save-settings')?.addEventListener('click', () => { soundEnabled=document.querySelector('#setting-sound').checked; animationsEnabled=document.querySelector('#setting-motion').checked; hapticsEnabled=document.querySelector('#setting-haptics').checked; themeId=document.querySelector('#setting-theme').value; woodFinish=document.querySelector('#setting-wood-finish').value; timeControlId=document.querySelector('#setting-time').value; personality=document.querySelector('#setting-personality').value; savePrefs(); showToast('Settings saved.'); renderSetup(); });
}

async function renderAnalysisPage() {
  const pgn = game.pgn();
  const history = game.history({ verbose:true });
  renderPageShell('Game Analysis', 'Stockfish best-move review. This compares played moves against the local engine’s top choice; it does not invent accuracy scores.', `<div class="analysis-panel feature-card"><p>Analyse up to the first 20 played positions using the installed local Stockfish worker. The engine must be installed with <code>npm run copy-engine</code>.</p><button class="primary-button" id="run-analysis">Run engine review</button><div id="analysis-results" class="analysis-results"></div></div>`);
  document.querySelector('#run-analysis')?.addEventListener('click', async () => {
    const button = document.querySelector('#run-analysis'); const output = document.querySelector('#analysis-results');
    button.disabled = true; output.innerHTML = '<p>Stockfish is reviewing the game…</p>';
    try {
      const replay = new Chess(); replay.loadPgn(pgn);
      const moves = replay.history({ verbose:true }).slice(0,20);
      const study = new Chess(); const rows = [];
      for (let i=0;i<moves.length;i++) {
        const played = moves[i]; const before = study.fen();
        const best = await engine.getMove(before, 'medium');
        const bestText = best ? `${best.slice(0,2)}–${best.slice(2,4)}${best[4]||''}` : 'No engine move';
        const playedUci = `${played.from}${played.to}${played.promotion||''}`;
        rows.push(`<div class="analysis-row"><span>${Math.floor(i/2)+1}${i%2===0?'.':'…'}</span><strong>${escapeHTML(played.san)}</strong><span>Engine: ${escapeHTML(bestText)}</span><em class="${best===playedUci?'best-match':'review-needed'}">${best===playedUci?'Top engine move':'Compare with engine line'}</em></div>`);
        study.move({ from:played.from, to:played.to, promotion:played.promotion || 'q' });
        output.innerHTML = `<p>Reviewed ${i+1} / ${moves.length} plies…</p>${rows.join('')}`;
      }
      output.innerHTML = `<h3>Engine review complete</h3>${rows.join('')}`;
    } catch(error) { output.innerHTML = `<p class="error-text">Analysis unavailable: ${escapeHTML(error.message)}</p>`; }
    finally { button.disabled = false; }
  });
}

function renderOnlineLobby(message = '') {
  onlineSession?.events?.close(); onlineSession = null;
  const previousRoom = readJSON('royal-realms-online-session-v1', null);
  renderPageShell('Private Online Match', 'Create a private invitation room or join a friend using their room code. Both browsers connect to the same Royal Realms game server.', `${previousRoom ? `<div class="feature-card active-save"><span class="feature-tag">SAVED ROOM</span><h3>${escapeHTML(previousRoom.code)}</h3><p>Reconnect while the same room server is still running.</p><button class="secondary-button" id="reconnect-room">Reconnect to room ↗</button></div>` : ''}<div class="online-lobby feature-grid"><article class="feature-card"><span class="feature-tag">CREATE ROOM</span><h3>Invite a friend</h3><label>Your name<input id="online-name" maxlength="24" value="${escapeHTML(profileData.name||'Player One')}"></label><button class="primary-button" id="create-room">Create private room</button><p>Share the eight-character room code with your opponent.</p></article><article class="feature-card"><span class="feature-tag">JOIN ROOM</span><h3>Enter invitation code</h3><input id="join-code" maxlength="8" placeholder="A1B2C3D4" autocomplete="off"><label>Your name<input id="join-name" maxlength="24" value="${escapeHTML(profileData.name||'Player Two')}"></label><button class="secondary-button" id="join-room">Join private room</button></article></div><p class="feature-footnote">The server must be running with <code>npm run server</code>. For two devices on a LAN, open the site using the host computer's LAN address and allow port 3002.</p><p id="online-error" class="error-text">${escapeHTML(message)}</p>`);
  document.querySelector('#reconnect-room')?.addEventListener('click', () => reconnectOnlineRoom(previousRoom));
  document.querySelector('#create-room')?.addEventListener('click', async () => {
    try {
      const data = await onlineRequest('/api/rooms', { name:document.querySelector('#online-name').value, baseMs:getTimeConfig().initial.w, incrementMs:getTimeConfig().increment });
      await enterOnlineRoom(data);
    } catch(error) { document.querySelector('#online-error').textContent = error.message; }
  });
  document.querySelector('#join-room')?.addEventListener('click', async () => {
    try {
      const code = document.querySelector('#join-code').value.trim().toUpperCase();
      const data = await onlineRequest(`/api/rooms/${encodeURIComponent(code)}/join`, { name:document.querySelector('#join-name').value });
      await enterOnlineRoom(data);
    } catch(error) { document.querySelector('#online-error').textContent = error.message; }
  });
}

function onlineBase() { return `${location.protocol}//${location.hostname}:3002`; }
async function onlineRequest(path, payload) {
  const response = await fetch(`${onlineBase()}${path}`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload || {}) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Online server returned ${response.status}.`);
  return data;
}

async function enterOnlineRoom(data) {
  onlineSession?.events?.close();
  onlineSession = { code:data.roomCode, token:data.token, color:data.color, players:{w:profileData.name||'White',b:null}, waiting:true, serverTurn:'w', serverClocks:{w:getTimeConfig().initial.w,b:getTimeConfig().initial.b} };
  localStorage.setItem('royal-realms-online-session-v1', JSON.stringify({ code:data.roomCode, token:data.token, color:data.color }));
  mode = 'online'; humanColor = data.color; orientation = data.color;
  game = new Chess(); gameResult = null; puzzleSession = null; redoStack = []; lastMove = null; selectedSquare = null; legalTargets = [];
  clockRemaining = { ...onlineSession.serverClocks }; clockStarted = false; stopClock();
  screen = 'game'; renderGame();
  const source = new EventSource(`${onlineBase()}/api/rooms/${encodeURIComponent(data.roomCode)}/events?token=${encodeURIComponent(data.token)}`);
  onlineSession.events = source;
  source.onmessage = event => applyOnlineState(JSON.parse(event.data));
  source.addEventListener('state', event => { try { applyOnlineState(JSON.parse(event.data)); } catch(error) { console.error('Online state update failed', error); } });
  source.onerror = () => { const pill=document.querySelector('#status-pill span'); if(pill) pill.textContent='Connection interrupted — reconnecting…'; };
}

function reconnectOnlineRoom(saved) {
  if (!saved?.code || !saved?.token) return;
  onlineSession = { ...saved, players:{w:'White',b:'Black'}, waiting:true, serverTurn:saved.color==='b'?'w':'w', serverClocks:{w:600000,b:600000} };
  mode='online'; humanColor=saved.color; orientation=saved.color; game=new Chess(); gameResult=null; stopClock(); screen='game'; renderGame();
  const source = new EventSource(`${onlineBase()}/api/rooms/${encodeURIComponent(saved.code)}/events?token=${encodeURIComponent(saved.token)}`);
  onlineSession.events=source;
  source.addEventListener('state', event => { try { applyOnlineState(JSON.parse(event.data)); } catch(error) { console.error('Online reconnect state failed',error); } });
  source.onerror = () => { const pill=document.querySelector('#status-pill span'); if(pill) pill.textContent='Reconnecting to private room…'; };
}

function applyOnlineState(state) {
  if (!onlineSession || state.code !== onlineSession.code) return;
  const before = game.fen();
  try { const next = new Chess(); if (state.pgn) next.loadPgn(state.pgn); else next.load(state.fen); game = next; }
  catch(error) { console.error('Rejected server state:', error); return; }
  onlineSession.waiting = state.waiting;
  onlineSession.serverTurn = state.turn;
  onlineSession.players = state.players;
  onlineSession.serverClocks = state.clocks;
  onlineSession.drawOfferBy = state.drawOfferBy;
  clockRemaining = { ...state.clocks };
  if (state.result) gameResult = state.result;
  const latest = game.history({ verbose:true }).at(-1);
  if (latest && before !== game.fen()) {
    lastMove = { from:latest.from, to:latest.to, piece:latest.piece, color:latest.color, captured:latest.captured||null, promotion:latest.promotion||null, san:latest.san, animate:Boolean(latest.captured) };
    playMoveSound(latest);
    if (game.isCheck()) announceCheck();
  }
  renderGame();
}

async function onlineAction(action) {
  if (!onlineSession) return;
  try { await onlineRequest(`/api/rooms/${encodeURIComponent(onlineSession.code)}/${action}`, { token:onlineSession.token }); }
  catch(error) { showToast(error.message, 'warning'); }
}

async function submitOnlineMove(from, to, promotion) {
  if (!onlineSession) return;
  try {
    const uci = `${from}${to}${promotion || ''}`;
    await onlineRequest(`/api/rooms/${encodeURIComponent(onlineSession.code)}/move`, { token:onlineSession.token, uci });
  } catch(error) { showToast(error.message, 'warning'); }
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
void dbGet('games', 'active').then(record => {
  if (!savedGame() && record && typeof record === 'object') {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(record)); if (screen === 'setup') renderSetup(); }
    catch (error) { console.warn('Could not restore IndexedDB game mirror:', error); }
  }
});
