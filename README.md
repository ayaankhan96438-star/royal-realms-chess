# Royal Realms Chess 1.5.0 — WebGL Resilience & Royal Coach Edition

A Vite chess application using `chess.js` as the single rules authority, Three.js for the real-time 3D board and Staunton-style models, and Stockfish.js in a Web Worker for computer play.

## Quick install on Kali / Linux

1. Download `royal-realms-chess-1.5.0-webgl-coach.zip` into `/home/ayaan/Downloads/`.
2. Open a terminal as your normal Linux user (for example `ayaan`), not root.
3. Run the following block. It backs up the current project, extracts the update, copies it into `/home/chess`, installs dependencies, checks the source, runs tests and builds the app.

```bash
cd /home/chess

# If a previous root terminal created root-owned files, fix ownership once:
sudo chown -R "$USER":"$USER" /home/chess

mkdir -p /tmp/royal-realms-first-release
unzip -o "$HOME/Downloads/royal-realms-chess-1.5.0-webgl-coach.zip" -d /tmp/royal-realms-first-release

bash /tmp/royal-realms-first-release/royal-realms-chess/scripts/install-kali.sh
```

If the ZIP is not yet in Downloads, download it from the ChatGPT attachment first. Do not type a folder path such as `~/Downloads/` as if it were a command.

## Manual commands

```bash
cd /home/chess
npm install
npm run copy-engine
npm run check
npm test
npm run build
npm run dev -- --host 0.0.0.0
```

Open `http://localhost:5173/`. Keep the Vite terminal running. The app uses localhost/HTTPS PWA service-worker rules; on a LAN, use the host computer's LAN IP address.

If npm reports that the `esbuild` install script was blocked and Vite later cannot start/build, review and approve it once:

```bash
npm install-scripts ls
npm install-scripts approve esbuild
npm install
```

## Start the private-match server too

The private match backend listens on port `3002` (port `3001` is left free for VS Code and other local services). Start Vite and the backend together in one terminal:

```bash
cd /home/chess
npm run start:all
```

Or use two terminals:

```bash
# Terminal 1 — Vite frontend
cd /home/chess
npm run dev -- --host 0.0.0.0
```

```bash
# Terminal 2 — private-room server
cd /home/chess
npm run server
```

For two devices on the same Wi-Fi, both users open `http://<KALI-LAN-IP>:5173/`. On the Kali host, get the address with `hostname -I`. Allow inbound TCP ports `5173` and `3002` in the local firewall. For friends on the public internet, the backend must be deployed on an internet-reachable HTTPS host and the frontend's `onlineBase()` in `src/main.js` must be configured to that backend. Do not expose the development server directly to the public internet.

## Implemented in this release

### Royal Realms differentiators added in 1.5.0

- **Wood Finish Studio:** five locally generated physical material presets (Heritage, Deep Walnut, Golden Oak, Ebony & Ivory, Cherrywood) applied to board squares, frame, tabletop, and both piece armies. The choice persists locally and is rendered by Three.js; it is not a flat image theme.
- **Royal Coach hint:** requests a legal recommendation from the installed local Stockfish worker and highlights its source square and legal destinations. It is disabled in private online matches and scored puzzle sessions to avoid assistance in competitive play.
- **WebGL recovery:** the renderer tries conservative WebGL context configurations for integrated/low-power GPUs. If WebGL2 is unavailable, the app keeps its legal 2D compatibility board but visibly labels it `2D SAFE MODE`, logs the actual renderer error, and shows the WebGL2 troubleshooting path. It never labels the fallback as 3D.

### Core chess and gameplay

- `chess.js` is the only rules engine used by the user interface and the private-room server.
- Standard chess legality, check/checkmate, stalemate, castling, en passant, promotion to Q/R/B/N, insufficient material and automatic draw status from the library.
- Undo/redo replays full legal moves through `chess.js`; local clock snapshots are restored with the move history.
- Restart, board flip, click-to-move, drag-and-drop, selected/legal destination highlights, last move and check/checkmate highlighting.
- Move history, captured pieces, move/capture audio, optional animations, reduced-motion preference and optional browser vibration requests.
- Game clocks: 1+0, 2+1, 3+0, 3+2, 5+0, 10+0, 15+10, 30+0 and a custom minute/increment prompt. Local clocks award increment and handle timeout; private online clocks are calculated by the room server.
- Offer/accept draw in local friend/private online mode, claim threefold repetition or 50-move draws, resignation and timeout results.
- PGN import/export, copy FEN and custom FEN position setup.
- Save/resume unfinished local game; local finished-game history; IndexedDB mirror for active game, profile, preferences and stats.

### 3D presentation

- Procedural Three.js Staunton pieces with real mesh geometry (king, queen, rook, bishop, horse-head knight and pawn), polished ivory/walnut materials, a thick hardwood frame, a generated oak/walnut board, and a wood-grain tabletop. Piece bases are positioned flush to the playing surface. Models are procedural because no licensed local GLB/GLTF models were included; they are not cropped reference photos or sprites.
- Ten realm themes, preview art cards, and a live 3D setup-board preview. The playable board uses the consistent oak/walnut set shown in the supplied reference; realm accents remain on the combat effects and surrounding UI.
- Role-specific procedural capture choreography rendered on the same board; no MP4/video is played. Attacker lunges/strikes, victim recoils/falls/fades, with impact and spark effects. Camera controls include zoom, 15-degree rotation steps, reset view, board flip and fullscreen.
- Bundled offline wooden-contact WAV sounds for moves and captures, with Web Audio fallback; check/mate audio cues; a full-screen CHECKMATE result card with winner and rematch/menu actions; subdued amber check and lavender checkmate indicators (no harsh flashing colors).
- Haptic calls use `navigator.vibrate` only when available. A typical laptop has no vibration motor; test on a supported Android device/browser.

### Offline computer and learning

- Stockfish.js UCI Web Worker. The game validates/applies all engine moves through `chess.js`.
- Seven selectable strengths: Beginner, Easy, Medium, Hard, Expert, Master and Grandmaster. Grandmaster uses the full single-threaded build with strength limiting disabled; it is not a guarantee that no human can ever win.
- Opponent styles: Royal Master, Aggressor, Guardian, Strategist and Gambler. Non-default styles select from multiple Stockfish candidates using a lightweight move preference; they are not separate neural models.
- Engine assets are copied locally with `npm run copy-engine`; the smaller engine is suitable for most levels. The full Grandmaster engine is large (roughly 94 MB, package/build dependent). Use it once online before expecting full-strength offline use; service-worker caching stores successfully fetched assets.
- Opening Academy includes nine validated starter lines: Italian, Sicilian, Queen's Gambit, London, Ruy Lopez, French, Caro-Kann, King's Indian and English.
- Puzzle Lab includes two validated checkmate-in-one exercises. This is a starter set, not a large daily puzzle database.
- Basic Stockfish move review compares up to 20 plies with the top engine move. It does not yet calculate complete accuracy scores, mistake/blunder classifications or natural-language coach explanations.

### Private online rooms

- A separate Node HTTP server creates private rooms and 8-hex-character invitation codes.
- Server-issued 256-bit seat tokens authorize the two players. The server owns the official `chess.js` position, rejects illegal/out-of-turn moves, runs the match clock, handles draw offers/claims/resignation and publishes snapshots through Server-Sent Events (SSE) with HTTP move actions.
- Completed room PGNs/results are written to `server/data/completed-games.json` on the host machine.
- This is a real private-room prototype, not simulated local multiplayer. It can be tested between two browsers/devices on the same LAN.

## Not yet delivered from the full master prompt

These are intentionally not shown as working or rated features:

- Account registration/login, authentication provider integration, player search, friends, blocks/reports, moderation, spectator mode, clubs and tournaments.
- Quick matchmaking and rated matchmaking; Glicko-2/leaderboards and competitive rating progression.
- A relational/document database. The room server persists completed match JSON to disk; active room state is in memory and is lost if the server restarts.
- Production-grade session security, origin allowlisting, HTTPS reverse proxy, durable active-room recovery, horizontal scaling and anti-cheat. Do not expose the local development server to the internet.
- Full daily/tactical puzzle catalogue, puzzle rating/progress suite and broad opening variations with per-move strategic commentary.
- Full analysis with evaluation graph/bar, engine classifications (brilliant/good/inaccuracy/mistake/blunder) and Royal Coach narrative explanations.
- Cloud profile, online achievements, global statistics, online rating and leaderboard.
- Cross-device account sync and full offline QA on a range of browsers/phones.

These items need additional backend/data work and hosting. No demo-only fake buttons or fabricated player/rating data are included.

## Chess.com feature audit and Royal Realms scope

Chess.com documents board/piece/background settings, move animations and sounds; its training and play catalogue includes lessons, puzzles, Puzzle Rush/Battles, game review, insights, game explorer, bots, live events, and variants. Royal Realms currently implements offline engine play, friend pass-and-play, private invite rooms, legal opening lessons, a starter puzzle set, local game history, simple engine move review, move clocks, PGN/FEN tools, procedural 3D capture sequences, a physical wood-finish studio, and local Stockfish hints. It does **not** claim parity with Chess.com's large online player network, master-game database, full lesson catalogue, rated matchmaking, tournaments, clubs, or hosted leaderboards. Those require curated content, durable accounts/data, moderation, and a deployed service; they are not simulated with fake data.

### Verification status for this package

The source syntax checks are run with Node's parser. Full Vite build and the chess.js-backed tests must be run on the Kali machine after `npm install`; the packaging environment may not have registry access. Browser/WebGL success also depends on the user's Chrome GPU/WebGL2 support and should be confirmed from the visible `LIVE 3D WOOD SET` marker. If the `2D SAFE MODE` marker appears, use the diagnostic text and `chrome://gpu` output rather than assuming the 3D renderer loaded.

## Commands and checks

```bash
npm run check   # JavaScript syntax checks for app, server, scripts and tests
npm test        # chess legality, special moves, puzzles/openings and private-room tests
npm run build   # Vite production build
npm run server  # only the room backend
npm run start:all # Vite + room backend in one terminal
```

Run `npm test` and `npm run build` on the Kali computer after installing dependencies. The packaging environment passed `npm run check` and both WAV tests. The remaining suites could not start because `chess.js` was unavailable after npm registry access timed out; run the full test/build sequence on Kali after `npm install`. The WAV asset tests are included in `npm test`. See `IMPLEMENTATION_STATUS.md` and `MASTER-PROMPT-COVERAGE.md` for exact delivery boundaries.
