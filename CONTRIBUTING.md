# Contributing to Bunny Runner 🐰

**Bunny Runner is complete.** Version 1.0.0 is the finished game, and the repository is closed to changes: no new features, no fixes, no pull requests, and issues aren't being handled. Finished was the goal. A small game that stays small and works is worth more than one that keeps growing.

Everyone taking part is expected to follow the [Code of Conduct](CODE_OF_CONDUCT.md). In short: be kind.

## What that means in practice

- **Every file is locked.** `FROZEN.sha256` holds the SHA-256 of each one, and `npm test` starts with `tests/freeze.mjs`, which fails if a file changed, was added or was removed. GitHub Actions runs it on every push and pull request, so a change can't merge green.
- **Reopening is deliberate.** It takes a commit that deletes `tests/freeze.mjs` and `FROZEN.sha256` and takes the freeze test out of the `test` script, and that commit should say why. It can't happen by accident.
- **Forking is welcome.** The game is MIT licensed. Run it with `npm start` (http://localhost:8080; there's nothing to install) and make it yours. In a fork, delete the freeze test first.

## If you do fork it

The rest of `npm test` is worth keeping, because it is what keeps the game simple, fast and cute:

- It needs Chrome or Chromium (found automatically, or set `CHROME_BIN`). Three.js is downloaded once and reused (offline: `THREE_JS=/path/to/three.min.js npm test`).
- `tests/budget.mjs` holds the game's size and per-frame cost to fixed numbers. Raise one only on purpose, and say why.
- The tests check that the README's tables, milestones, achievement titles, layout and links match the code.
- Images are generated: change `scripts/make-assets.mjs` and run `npm run assets`.
- Show and hide screens only through `UIController.showScreen`, so a hidden screen stays out of the Tab order.
- No frameworks, bundlers or build tooling, and no big assets.
