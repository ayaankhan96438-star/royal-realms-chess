# Third-party notices

This project depends on the following libraries. Retain their upstream license and notice files when redistributing the app and engine assets.

- **Three.js 0.187.0** — MIT. https://github.com/mrdoob/three.js
- **chess.js 1.4.0** — BSD 2-Clause. https://github.com/jhlywa/chess.js
- **Stockfish.js / Stockfish 19.0.1** — GPL-3.0. https://github.com/nmrugg/stockfish.js and https://github.com/official-stockfish/Stockfish
- **Vite** — MIT. https://github.com/vitejs/vite

The Stockfish package is GPL-3.0. The npm dependency provides engine binary/source and licensing materials in its installed package. If you redistribute compiled Stockfish JS/WASM engine files, include the exact license and source/build materials required by GPL-3.0; do not remove the corresponding notices from `node_modules/stockfish`. This project does not bundle the npm `node_modules` directory in its ZIP. Run `npm install` and `npm run copy-engine` to copy the selected browser engine files into `public/engine/`.

The board theme preview artwork under `public/assets/` is project-specific generated concept artwork. The actual chessboard and chessmen are generated procedurally by `src/three-board.js` at runtime; the preview art is not used as a chess piece texture.
