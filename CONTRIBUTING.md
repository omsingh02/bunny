# Contributing to Bunny Runner 🐰

Thanks for helping! The goal is a game that stays **simple, fast and cute**: plain JavaScript modules, no frameworks, no build step, no asset files.

## Run it

```bash
git clone https://github.com/omsingh02/bunny.git
cd bunny
npm start          # http://localhost:8080
```

There's nothing to install. Edit a file and refresh.

## Before you open a pull request

- **`npm test` passes.** It needs Chrome or Chromium (found automatically, or set `CHROME_BIN`) and internet for Three.js (offline: `THREE_JS=/path/to/three.min.js npm test`). GitHub Actions runs it on every pull request too.
- **Keep the README true.** The tests check its difficulty table, milestones, achievement titles, project layout and links against the code, so if you change those, update the README.
- **Show, don't tell.** For anything you can see, add a screenshot or a short clip to the pull request.
- **Images are generated.** Don't edit the icons, `preview.png` or the screenshots by hand. Change `scripts/make-assets.mjs` and run `npm run assets`.

## Where things live

The README has the project layout and a "Make it yours" table that points at the right file for common changes: new obstacles, treats, sounds, achievements and difficulty tuning.

## What fits

- New obstacles, treats, sounds, achievements and scenery
- Tuning, bug fixes and phone polish
- Accessibility improvements

## What doesn't

- Frameworks, bundlers or build tooling
- Big assets (the whole game is about 31 KB gzipped, and that's part of the charm)
- Anything that makes the game slower to load or start

## Found a bug or have an idea?

[Open an issue](https://github.com/omsingh02/bunny/issues/new/choose). For bugs, your device and browser help the most.
