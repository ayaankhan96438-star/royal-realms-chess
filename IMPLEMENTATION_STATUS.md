# Implementation status — Royal Realms Chess 1.5.0

## Delivered first-release functionality

- Premium responsive setup/game shell, ten board themes, live Three.js realm preview, and a reference-inspired natural oak/walnut match scene.
- Procedural 3D wooden Staunton mesh pieces, oak/walnut board and tabletop, real-time lighting/shadows, click/drag input, legal-target/last-move/check highlighting, board flip, camera zoom/rotation/reset/fullscreen, and capture choreography.
- `chess.js` as the single chess-rules authority; standard game, special moves, legal promotion options and chess terminal/draw status.
- Stockfish.js UCI Web Worker, seven strength settings and five lightweight MultiPV preference profiles.
- Local computer and same-device friend modes; local clocks/time controls, increment and timeout; draw claim, draw offer in friend mode, resignation, undo/redo, restart, PGN import/export, FEN copy and custom FEN setup.
- Save/resume, local finished games, player profile, local statistics and event-based achievements.
- IndexedDB mirrors active saves, preferences, profile/stat records; localStorage remains the synchronous startup fallback.
- Nine validated opening starter lines, two validated checkmate-in-one puzzles, basic Stockfish top-move review for up to 20 plies.
- Private online rooms using Node HTTP + SSE, cryptographic invitation codes/seat tokens, server-side move validation and server clocks. Completed games are persisted as JSON on the host.
- Full-screen checkmate result with winner/rematch/menu controls; offline move/capture WAV samples with generated Web Audio fallback; PWA service worker precaches the audio; local Stockfish asset-copy script. Private-room server default is port 3002 to avoid the VS Code port 3001 conflict.

## Master-prompt items that remain incomplete

- Accounts/authentication; quick matchmaking; Glicko-2 ratings; online leaderboard; friends/social/tournaments/spectators/moderation.
- Production online persistence for active rooms and a real database. Active rooms are memory-only; completed matches use a local JSON file.
- Production deployment security: HTTPS/reverse proxy, origin allowlist, durable sessions, scaling, abuse/anti-cheat systems.
- Comprehensive puzzle library/daily challenges and detailed opening variants with per-move strategic coaching.
- Full game analysis/evaluation graphs and classifications, and a complete Royal Coach explanation layer.
- Account-backed cross-device profile and achievement synchronization.
- Full device/browser QA and real offline-reload testing on target devices.

## Verification

- Passed in packaging environment: `npm run check` (Node syntax checks for app, board, engine, themes, server, storage, training, scripts and tests); `node --test tests/wood-audio.test.mjs` validates both bundled PCM WAV files (2/2 passed).
- Full `npm test` was attempted. The two audio tests passed; the chess-rules, online-room and training suites could not start because this packaging environment has no installed `chess.js` dependency. An npm registry installation attempt timed out.
- `npm run build`, actual browser/3D rendering, Stockfish worker launch and two-device LAN match were not verifiable in this packaging environment because the app dependencies could not be installed here.
- On Kali, run `npm install`, `npm run copy-engine`, `npm run check`, `npm test` and `npm run build` after installing this update; then manually verify WebGL rendering and online connectivity.


## 1.5.0 update
- Added five real Three.js wood finish presets saved in local preferences.
- Added a local Stockfish Royal Coach move hint; disabled in online/puzzle modes.
- Improved WebGL2 context creation retries and made the 2D fallback explicitly labelled with the runtime error.
- The board is only labelled LIVE 3D WOOD SET when the Three.js constructor succeeds.
