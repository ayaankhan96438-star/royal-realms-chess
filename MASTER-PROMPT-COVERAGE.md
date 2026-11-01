# Master prompt coverage

| Master-prompt area | In this release | Boundary |
|---|---|---|
| Existing project preservation | Yes | Updates are additive/replacements inside the current project; installer creates a timestamped backup. |
| Premium visual shell | Yes | Desktop/mobile responsive design is included; browser QA remains local. |
| Board themes and pieces | Yes | Ten selectable realms; six procedural 3D Staunton piece types in polished ivory and dark walnut with a generated wooden tabletop and board. |
| Board interaction | Yes | Click, drag, legal moves, selection/last-move/check highlights, flip, zoom, rotate, reset camera, fullscreen and captured display. |
| Complete chess rules | Yes, via chess.js | Automated test coverage is included; run it locally. |
| Game controls | Mostly | Undo/redo/restart, clocks, draw claim/offer, resign, save/resume, PGN import/export, FEN copy/setup, fullscreen and a checkmate result screen. Online undo/redo intentionally disabled. |
| Offline Stockfish | Yes, after local engine install/cache | Worker, local JS/WASM, configurable strength. Full build is large. |
| AI personalities | Basic | MultiPV candidate bias; not separate trained models. |
| Offline persistence | Partial | IndexedDB mirror + localStorage fallback; no cloud sync. |
| Private online match | Prototype implemented | Server-authoritative rules/clocks, room tokens, SSE. Works once server is started and reachable. |
| Quick matchmaking / rated play | No | Requires accounts, durable database, matchmaking and rating service. |
| AI analysis / coach | Basic analysis only | Top-move comparison; no full eval graph/classification/narrative coach yet. |
| Puzzles | Starter set | Two legal checkmate-in-one puzzles only. |
| Opening academy | Starter set | Nine legal starter lines, no complete variation curriculum. |
| Player profiles / achievements | Local only | Local statistics/achievements; no online identities or verified ratings. |
| Leaderboards / social / tournaments | No | Requires deployed account and community backend. |
| Production QA | Not yet | Syntax checks pass; dependency-backed tests/build and device QA (offline reload, mobile haptics and two-device matches) still need to be run on the Kali installation. |

The attached master prompt explicitly permits a fully functional first release when the whole product cannot be completed in one pass. This file states what is actually delivered rather than presenting unfinished features as operational.
