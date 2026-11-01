# Royal Realms Chess 1.5.1 fixes

- Fixed online-room draw handling: threefold repetition and the fifty-move rule remain claimable instead of ending the game automatically.
- Added automatic server-side draws for fivefold repetition and the seventy-five-move rule.
- Kept checkmate, stalemate, and insufficient-material handling as automatic results.
- Fixed the en-passant test to accept the `undefined` empty-square result returned by chess.js 1.4.0.
- Added a regression test proving that threefold repetition can be claimed and fivefold repetition ends automatically.

Run `npm run check`, `npm test`, and `npm run build` after installing dependencies.
