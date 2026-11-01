# Royal Realms Chess

A cinematic chess website with ten selectable board worlds, local two-player mode, a computer opponent, move history, PGN export, and offline-ready PWA support.

## What is included

- 10 visual themes: Obsidian Realm, Frostspire, Mystic Empire, Zenith Classic, Shadow Crown, Celestial Order, Dragon's Fang, Nordic Legacy, Void Realm, and Royal Aurora.
- Theme selection cards use the generated concept-art previews. Selecting a realm updates the preview in place (without rebuilding the full setup screen), then changes the playable board palette and piece tint.
- Play the engine: Beginner, Easy, Medium, Hard, Expert, Master, and Grandmaster target levels.
- Play a friend: local pass-and-play on one device.
- Full legal chess rules through `chess.js`: legal moves, check, checkmate, stalemate, castling, en passant, promotion, and draw rules.
- Promotion chooser, last-move highlighting, legal-move dots, board flip, take-back, restart, captured pieces, move history, and PGN export.
- Six transparent sculptural chess-piece sprites (king, queen, rook, bishop, knight, pawn), recolored for both sides and tinted by realm. They are lightweight 2.5D/3D-rendered WebP assets, not heavy live 3D meshes.
- A persistent high-contrast CHECK / CHECKMATE banner, a pulsing red outline around the threatened king, a two-tone check sound, and optional device vibration on browsers that support the Vibration API.
- Piece-specific capture choreography: the attacking model lunges, the captured model shatters/fades, and a realm-colored slash, sparks and capture label mark the impact.
- Stockfish 19 lite single-threaded WebAssembly engine for quick levels, plus the full single-threaded build for Grandmaster, copied into the local app by the postinstall script.
- PWA manifest and service worker to cache the game for offline play after the first successful online visit/install.

## Run on Kali Linux / Linux

Install Node.js 20.19+ or 22.12+ and npm. Then open a terminal in this project folder:

```bash
npm install
npm run dev
```

Open the local URL Vite prints, usually `http://localhost:5173`.

To create a production build:

```bash
npm run build
npm run preview
```

The production output is created in `dist/`.

### Engine setup

`npm install` downloads `stockfish` and automatically runs `scripts/copy-engine.cjs`, which copies the Stockfish 19 lite single-threaded files and the full single-threaded files into `public/engine/`. The lite pair is about 1.7 MB; the full pair is about 94 MB. The Grandmaster level uses the full pair, while the other levels use lite. The full single-threaded build does not need cross-origin isolation.

If the engine is not copied, run:

```bash
npm run copy-engine
```

The game remains playable with a small built-in practice opponent if the Stockfish files are missing. That fallback is not grandmaster strength; install the Stockfish engine for the intended computer levels.

### Offline use

1. Run or host the production build over `localhost` or HTTPS.
2. Open the website once while online and let it finish loading.
3. Install it from the browser when the install option is offered (or use the browser's Install App menu).
4. The service worker caches the app shell, theme preview images, and the lite engine. The full Grandmaster engine is cached when it is first loaded, so play one Grandmaster game while online before relying on that mode offline. The installed game can then be reopened without internet.

Service workers do not work from a plain `file://` URL. Use Vite, a local HTTP server, or an HTTPS host.

## Notes and honest limitations

- The current friend mode is pass-and-play on the same device. Playing a friend on a different device needs an online room/signaling server; that remote multiplayer backend is not part of this first build.
- The Grandmaster option switches to the full Stockfish build, disables deliberate strength limiting and gives it the longest search time in this UI. The Master setting uses a 2800 CCRL Elo limit. Elo labels are engine calibration targets, not FIDE human ratings. It is a very strong computer opponent, but no software can honestly guarantee that it is literally impossible for every human to beat it. Actual strength depends on device performance, engine build, and search time.
- The bundled stockfish npm package is GPL-3.0 licensed. Review its license obligations before distributing a public hosted version with the engine bundled. `chess.js` is a separate dependency; check its upstream license too.
- The sculpted sprites are rendered images rather than rigged 3D meshes; they are intentionally lightweight for smooth play on mid-range laptops.

## Project files

```text
royal-realms-chess/
├── index.html
├── package.json
├── README.md
├── scripts/
│   └── copy-engine.cjs
├── public/
│   ├── icon.svg
│   ├── manifest.webmanifest
│   ├── sw.js
│   ├── assets/                 # 10 generated theme preview images
│   ├── pieces/                 # 6 transparent sculptural piece sprites
│   └── engine/                 # added after npm install
└── src/
    ├── main.js                 # screens, moves, game modes, check/capture feedback
    ├── engine.js               # Stockfish UCI worker client
    ├── themes.js               # themes and difficulty settings
    └── styles.css              # responsive design, metallic sprites and capture animation
```