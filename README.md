# 🐰 Bunny Runner - Cute Endless Adventure

A small, cute 3D endless runner built with Three.js. Hop between three lanes, jump over flowers, logs and rocks, and collect hearts, stars and bunny plushies.

## 🎮 Features

- **3D graphics** with Three.js (r128, loaded from a CDN) - all models are built from primitives, no asset files
- **One page for every screen size**: keyboard on desktop, buttons + swipes on phones
- **Combos**: grab treats back to back (3 second window) for up to a 10x multiplier
- **Milestones, achievements and a leaderboard** (top 10 per difficulty), all saved in your browser
- **Three difficulties**: Easy, Medium, Hard
- **Procedural sound**: every sound effect and the background tune are synthesized with the Web Audio API

## 🚀 Run it

It's a static site. Serve the folder with anything:

```bash
npm start            # python3 -m http.server 8080  ->  http://localhost:8080
```

## 🕹️ Controls

| | Move | Jump | Pause |
|---|---|---|---|
| Keyboard | ← → or A D | Space, ↑ or W | Esc |
| Phone | swipe left/right, or the arrow buttons | swipe up, tap, or the ↑ button | the ‖ button |

The game also pauses by itself when you switch tabs or apps.

## 🎯 How it plays

- Distance earns points, treats are worth 10 each times your combo (up to 10x).
- The game speeds up as your score grows, up to a top speed per difficulty.
- Milestones at 100, 250, 500, 750, 1000, 1500, 2000, 3000 and 5000 points.

| Difficulty | Name | Feel |
|---|---|---|
| Easy | Relaxed Garden Stroll | slow, few obstacles |
| Medium | Bunny Hop Fun | the classic |
| Hard | Speedy Meadow Dash | fast and busy |

## 📁 Project layout

```
index.html                 the whole game UI (all screens live here)
assets/
  scripts/game.js          game state, scoring and the main loop
  scripts/modules/         AudioSynth, ProceduralModels, WorldManager, PhysicsEngine,
                           ParticleSystem, InputController, UIController,
                           StorageManager, AnalyticsManager, dom
  styles/game.css          all the styling (pastel theme via CSS custom properties)
  fonts/                   self-hosted Inter
  icons/                   favicon.svg + PNG icons (generated, see below)
  screenshots/             install-dialog screenshots (generated)
  manifest.json            home-screen install info
favicon.ico, preview.png   tab icon and the link-preview image (generated)
404.html, robots.txt, sitemap.xml, CNAME, .nojekyll   GitHub Pages / SEO basics
mobile/index.html          just redirects to index.html (old links keep working)
scripts/make-assets.mjs    regenerates all the images
tests/                     npm test (see below)
```

## 🖼️ Icons, preview image and screenshots

Every image is generated, so a change to the bunny drawing or the look of the game is one command:

```bash
npm run assets               # everything
npm run assets icons         # favicon.svg/.ico, apple-touch-icon, PWA icons (any + maskable)
npm run assets screenshots   # preview.png (1200x630 link card) + the install screenshots
```

The bunny icon is drawn in `scripts/make-assets.mjs`; the screenshots are real frames of the game.
Needs `chromium` (and internet for Three.js, or `THREE_JS=/path/to/three.min.js`); `optipng` is used if installed.

## 🧪 Tests

```bash
npm test
```

- `tests/wiring.mjs` - instant, no browser: checks every element id the JS looks up exists in `index.html`, every file the pages, manifest and CSS reference exists (with the right image sizes), the link-preview/canonical/sitemap tags agree with `CNAME`, and the leaderboard logic.
- `tests/smoke.mjs` - opens the game in headless Chromium and clicks through menu, difficulty, play, pause, settings and game over. Needs `chromium` on your PATH and internet for Three.js (or `THREE_JS=/path/to/three.min.js npm test` to run offline).

## 📄 License

This project is open source and available for personal and educational use.
