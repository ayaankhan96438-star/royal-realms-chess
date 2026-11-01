# Royal Realms Chess — Realtime 3D arena update

Royal Realms is a Vite-powered chess game with 10 board realms, local two-player mode, a Stockfish opponent, save/resume, PGN export and offline support.

## What's changed in this update

- The game board now uses Three.js and procedural, live 3D chess-warrior meshes. These are real WebGL meshes with lighting, metallic materials, shadows, crowns, armor, shields and weapons; they are not cropped images.
- Each piece type has a distinct 3D silhouette and capture motion: knight leap, king sword strike, queen sweep, rook charge, bishop staff/energy strike and pawn thrust.
- Check is persistent in the UI, the threatened king gets a glowing ring, and check sound plus the browser vibration API are triggered when supported.
- The five supplied reference combat videos are integrated as cinematic scenes for the matching actions: knight captures queen, pawn battle, bishop defeats knight, king battles pawn and queen checkmates king. Other captures use the live 3D board combat animation.
- The old cropped piece-image assets have been removed. Theme preview art remains only in the board-selection gallery.
- The service worker caches the 10 board previews and the combat clips for offline use. Video range requests are served from the cached full file.

## Install / update

From the extracted project directory:

```bash
npm install
npm run copy-engine
npm run build
npm run dev -- --host 0.0.0.0
```

Open the Vite URL printed in the terminal, normally `http://localhost:5173/`.

Three.js is an npm dependency and is bundled by Vite for offline runtime use after installation. WebGL must be enabled in the browser. If WebGL cannot start, the app falls back to the accessible 2D board.

## Vibration note

The game calls `navigator.vibrate()` for check and checkmate alerts and includes a haptics test. Most laptops do not contain a vibration motor and desktop browsers generally do not expose hardware vibration. Test haptics on a supported Android phone/browser with a vibration motor. Sound and visual check alerts work on desktop.

## Art / animation note

The chess pieces are procedurally built 3D meshes. They are not photogrammetry or rigged AAA character assets. The supplied videos are used as pre-rendered cinematic cutscenes for their matching move types; all other captures use realtime procedural 3D choreography. For fully photorealistic humanoid battles for every possible attacker/victim pair, the next production step is a set of custom rigged GLB models with authored skeletal animations.

## Project structure

```text
index.html
package.json
src/
  main.js
  engine.js
  themes.js
  three-board.js
  styles.css
public/
  assets/       10 board realm preview images
  cinematics/   supplied short combat clips
  engine/       Stockfish files copied by scripts/copy-engine.cjs
  sw.js
scripts/
  copy-engine.cjs
```
