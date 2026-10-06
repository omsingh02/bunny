// make-assets.mjs - regenerates every image the site needs, from code:
//   assets/icons/favicon.svg, favicon.ico, apple-touch-icon.png, PWA icons (any + maskable),
//   preview.png (the link-preview / social card) and the install-dialog screenshots.
//
//   npm run assets               (everything)
//   npm run assets icons         (just the icons)
//   npm run assets screenshots   (just preview.png + the screenshots)
//   npm run assets demo          (the gameplay GIF for the README; needs ffmpeg, ~2 minutes)
//
// Needs Chrome or Chromium (found automatically, or set CHROME_BIN): it renders the icons and plays the real game.
// Three.js comes from the CDN; no internet? THREE_JS=/path/to/three.min.js npm run assets
// If `optipng` / `gifsicle` are installed the PNGs / the GIF are squeezed a little.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { startStaticServer } from '../tests/helpers/static-server.mjs';
import { CdpClient } from '../tests/helpers/cdp-client.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function save(file, data) {
    const target = path.join(root, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, data);
    if (file.endsWith('.png')) spawnSync('optipng', ['-quiet', '-o3', target], { stdio: 'ignore' }); // fine if it's not installed
    console.log(`  ${file}  (${(fs.statSync(target).size / 1024).toFixed(1)} KB)`);
}

// ---- the bunny icon: one drawing, used for every icon -----------------------------------------

const BUNNY = `
  <ellipse cx="190" cy="152" rx="44" ry="112" fill="#fff" transform="rotate(-11 190 152)"/>
  <ellipse cx="190" cy="158" rx="22" ry="84" fill="#FFB3D1" transform="rotate(-11 190 152)"/>
  <ellipse cx="322" cy="152" rx="44" ry="112" fill="#fff" transform="rotate(11 322 152)"/>
  <ellipse cx="322" cy="158" rx="22" ry="84" fill="#FFB3D1" transform="rotate(11 322 152)"/>
  <ellipse cx="256" cy="322" rx="150" ry="134" fill="#fff"/>
  <circle cx="166" cy="352" r="27" fill="#FFB3D1" opacity=".85"/>
  <circle cx="346" cy="352" r="27" fill="#FFB3D1" opacity=".85"/>
  <circle cx="204" cy="306" r="20" fill="#3A2347"/>
  <circle cx="197" cy="298" r="7" fill="#fff"/>
  <circle cx="308" cy="306" r="20" fill="#3A2347"/>
  <circle cx="301" cy="298" r="7" fill="#fff"/>
  <path d="M238 338 q18-14 36 0 q-18 22-36 0z" fill="#FF4F9A"/>
  <path d="M256 354 v14 M256 368 q-14 14-30 4 M256 368 q14 14 30 4" stroke="#B5487F" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;

// rounded: rounded-square icon (favicon, "any" icons). Not rounded = full-bleed square, which the
// OS crops itself (maskable + apple-touch-icon); `scale` keeps the bunny inside that safe zone.
function bunnySvg({ rounded = true, scale = 1 } = {}) {
    const shift = 256 * (1 - scale);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF7BB8"/><stop offset="1" stop-color="#B993FF"/></linearGradient></defs>
  <rect width="512" height="512"${rounded ? ' rx="112"' : ''} fill="url(#bg)"/>
  <g transform="translate(${shift} ${shift}) scale(${scale})">${BUNNY}
  </g>
</svg>
`;
}

// a .ico is a small header plus PNGs
function buildIco(pngs) {
    const header = Buffer.alloc(6);
    header.writeUInt16LE(1, 2);            // type: icon
    header.writeUInt16LE(pngs.length, 4);
    let offset = 6 + 16 * pngs.length;
    const entries = pngs.map(({ size, data }) => {
        const entry = Buffer.alloc(16);
        entry.writeUInt8(size, 0);         // width
        entry.writeUInt8(size, 1);         // height
        entry.writeUInt16LE(1, 4);         // colour planes
        entry.writeUInt16LE(32, 6);        // bits per pixel
        entry.writeUInt32LE(data.length, 8);
        entry.writeUInt32LE(offset, 12);
        offset += data.length;
        return entry;
    });
    return Buffer.concat([header, ...entries, ...pngs.map(p => p.data)]);
}

async function makeIcons() {
    console.log('Icons');
    const browser = new CdpClient({ port: 9361 });
    await browser.launch('about:blank');
    try {
        await browser.transparentBackground();
        const render = async (svg, size) => {
            await browser.setViewport(size, size);
            const html = `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`;
            await browser.goto('data:text/html;charset=utf-8,' + encodeURIComponent(html));
            await browser.waitFor(`document.readyState === 'complete'`);
            return browser.screenshot();
        };

        save('assets/icons/favicon.svg', bunnySvg());
        const icon192 = await render(bunnySvg(), 192);
        const icon512 = await render(bunnySvg(), 512);
        save('assets/icons/icon-192.png', icon192);
        save('assets/icons/icon-512.png', icon512);
        save('assets/icons/icon-maskable-512.png', await render(bunnySvg({ rounded: false, scale: 0.68 }), 512));
        save('assets/icons/apple-touch-icon.png', await render(bunnySvg({ rounded: false, scale: 0.86 }), 180));
        const frames = [];
        for (const size of [16, 32, 48]) frames.push({ size, data: await render(bunnySvg(), size) }); // one at a time: they share the page
        save('favicon.ico', buildIco(frames));
    } finally {
        await browser.close();
    }
}

// ---- screenshots of the real game -------------------------------------------------------------

// Stages one good-looking frame: the bunny mid-hop, treats zig-zagging up the track, obstacles
// further back, a believable score, a 3x combo and no achievement toast. The game loop is frozen
// at the end, so the picture is exactly what's set up here.
const STAGE = `(() => {
    for (const achievement of Object.values(game.achievements)) achievement.unlocked = true; // no toast in the picture
    const world = game.worldManager;
    const put = (thing, lane, z) => { thing.position.x = game.lanes[lane]; thing.position.z = z; };
    for (const [lane, z] of [[0, -2.5], [2, -4.5], [0, -7], [2, -9.5], [1, -12], [0, -14.5]]) {
        world.createCollectible(z);
        put(world.collectibles.at(-1), lane, z);
    }
    for (const [lane, z] of [[0, -11], [2, -15]]) {
        world.createObstacle(z);
        put(world.obstacles.at(-1), lane, z);
    }
    game.bestScore = 2450;
    game.score = 340;
    game.lastMilestone = 250;
    game.checkMilestone();
    game.comboCount = 3;
    game.comboExpires = 999;
    game.updateScore();
    game.bunny.position.set(0, 1.0, 0);
    game.bunny.rotation.set(-0.3, 0, 0.08);
    game.gameState = 'frozen';       // the loop stops updating...
    game.renderPending = true;       // ...after drawing this one frame
    return 1;
})()`;

async function makeScreenshots() {
    console.log('Screenshots');
    const server = await startStaticServer(root);
    try {
        const shoot = async (file, viewport, { touch = false } = {}) => {
            const browser = new CdpClient({ port: 9362 });
            await browser.launch('about:blank', viewport);
            try {
                await browser.blockUrls(['https://a.omsingh.me/*']); // a screenshot run shouldn't count as a visitor
                if (process.env.THREE_JS) await browser.serveFile('https://cdnjs.cloudflare.com/ajax/libs/three.js/*', process.env.THREE_JS);
                if (touch) await browser.setTouch(true);
                await browser.goto(server.url + '/');
                await browser.waitFor(`window.game?.gameState === 'menu'`, 30000);

                await browser.evaluate(`document.getElementById('start-btn').click(); 1`);
                await browser.waitFor(`game.gameState === 'playing'`, 15000);
                await browser.evaluate(STAGE);

                await sleep(700);                                    // let the frame and the HUD glow settle
                save(file, await browser.screenshot());
            } finally {
                await browser.close();
            }
        };

        await shoot('preview.png', { width: 1200, height: 630, isMobile: false });
        await shoot('assets/screenshots/wide.png', { width: 1280, height: 720, isMobile: false });
        await shoot('assets/screenshots/narrow.png', { width: 390, height: 844, isMobile: true }, { touch: true });
    } finally {
        await server.stop();
    }
}

// ---- demo GIF: an autopilot plays the real game ---------------------------------------------------
// The game is stepped by hand at a fixed 30 steps a second, with seeded randomness, so the clip comes
// out identical every time. Cheap trial runs (no screenshots) pick a seed where the bunny plays well.

const DEMO = { width: 960, height: 504, fps: 30, warmup: 60, frames: 90, every: 2, gifWidth: 720 };
// 90 frames, one per 2 steps = 6 seconds at 15 frames a second

const seeded = (seed) => `(() => { let s = ${seed}; Math.random = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; })();`;

// Runs inside the page: takes over the clock, then plays by looking at what's ahead of the bunny.
const AUTOPILOT = `(() => {
    const dt = 1 / ${DEMO.fps};
    game.animate = () => {};                  // the real loop stops: we step the game by hand
    game.gameOver = () => {};                 // trials count hits instead of ending the run
    game.clock.getDelta = () => dt;
    for (const achievement of Object.values(game.achievements)) achievement.unlocked = true; // no toasts
    game.bestScore = 1240;
    game.updateScore();

    // timers and CSS animations follow the same hand-cranked clock, so pop-ups last as long as they should
    let now = 0, nextId = 1;
    const timers = new Map(), known = new WeakSet();
    window.setTimeout = (fn, ms = 0) => { timers.set(nextId, { due: now + ms, fn }); return nextId++; };
    window.clearTimeout = (id) => timers.delete(id);
    const advanceClock = (ms) => {
        now += ms;
        for (const [id, timer] of [...timers]) if (timer.due <= now) { timers.delete(id); timer.fn(); }
        for (const animation of document.getAnimations()) {
            animation.pause();
            animation.currentTime = known.has(animation) ? animation.currentTime + ms : ms;
            known.add(animation);
        }
    };

    // the pilot: dodge what's coming, otherwise chase the nearest treat
    const laneOf = (thing) => Math.round((thing.position.x - game.lanes[0]) / (game.lanes[1] - game.lanes[0]));
    const ahead = (thing) => -thing.position.z;           // distance in front of the bunny
    let cooldown = 0;
    const steer = () => {
        const { obstacles, collectibles } = game.worldManager;
        const reach = 4 + game.speed * 0.45;
        const blocked = (lane, within) => obstacles.some(o => laneOf(o) === lane && ahead(o) > -1.2 && ahead(o) < within);
        const here = game.currentLane;
        if (cooldown > 0) cooldown--;

        if (blocked(here, reach)) {
            const near = obstacles.filter(o => laneOf(o) === here && ahead(o) > -1.2).sort((a, b) => ahead(a) - ahead(b))[0];
            const urgent = ahead(near) < game.speed * 0.5;
            const free = [here - 1, here + 1].filter(l => l >= 0 && l < game.lanes.length && !blocked(l, reach + 3));
            if (free.length) {
                if (cooldown === 0 || urgent) {
                    const hasTreat = (l) => collectibles.some(c => laneOf(c) === l && ahead(c) > 1 && ahead(c) < 18);
                    const lane = free.find(hasTreat) ?? free.sort((a, b) => Math.abs(a - 1) - Math.abs(b - 1))[0];
                    game.moveLane(lane - here);
                    cooldown = 10;
                }
            } else if (!game.isJumping && ahead(near) <= game.speed * 0.2355 + 0.3) {
                game.jump();                                  // boxed in: hop over it (peak lines up with the obstacle)
            }
            return;
        }

        if (cooldown > 0) return;
        const treat = collectibles.filter(c => ahead(c) > 2 && ahead(c) < 18).sort((a, b) => ahead(a) - ahead(b))[0];
        if (treat && laneOf(treat) !== here && !blocked(laneOf(treat), ahead(treat) + 3)) {
            game.moveLane(Math.sign(laneOf(treat) - here));
            cooldown = 10;
        }
    };

    window.__demo = { gemsAtStart: 0, clipCombo: 0 };
    window.__step = async (draw) => {
        steer();
        game.update();
        advanceClock(dt * 1000);
        window.__demo.clipCombo = Math.max(window.__demo.clipCombo, game.comboCount);
        if (draw) {
            game.renderer.render(game.scene, game.camera);
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); // let the frame reach the screen
        }
    };
    return 1;
})()`;

// one run of the clip; with `capture` it returns a PNG for every GIF frame
async function playDemo(server, seed, { capture }) {
    const browser = new CdpClient({ port: 9363 });
    await browser.launch('about:blank', { width: DEMO.width, height: DEMO.height, isMobile: false });
    try {
        await browser.blockUrls(['https://a.omsingh.me/*']);
        if (process.env.THREE_JS) await browser.serveFile('https://cdnjs.cloudflare.com/ajax/libs/three.js/*', process.env.THREE_JS);
        await browser.evalOnNewDocument(seeded(seed));
        await browser.goto(server.url + '/');
        await browser.waitFor(`window.game?.gameState === 'menu'`, 30000);
        await browser.evaluate(`document.getElementById('start-btn').click(); 1`);
        await browser.waitFor(`game.gameState === 'playing'`, 15000);
        await browser.evaluate(AUTOPILOT);

        const frames = [];
        for (let step = 0; step < DEMO.warmup + DEMO.frames * DEMO.every; step++) {
            if (step === DEMO.warmup) await browser.evaluate(`__demo.gemsAtStart = game.gemsCollectedThisRun; __demo.clipCombo = 0; 1`);
            const shoot = capture && step >= DEMO.warmup && (step - DEMO.warmup) % DEMO.every === 0;
            await browser.evaluate(`__step(${shoot})`);
            if (shoot) frames.push(await browser.screenshot());
        }
        const stats = await browser.evaluate(`({ hits: game.obstacleHitsThisRun, gems: game.gemsCollectedThisRun - __demo.gemsAtStart, combo: __demo.clipCombo })`);
        return { ...stats, frames };
    } finally {
        await browser.close();
    }
}

function assembleGif(frames) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bunny-demo-'));
    try {
        frames.forEach((png, i) => fs.writeFileSync(path.join(dir, `frame-${String(i).padStart(3, '0')}.png`), png));
        const out = path.join(dir, 'demo.gif');
        const filter = `scale=${DEMO.gifWidth}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=160[p];[b][p]paletteuse=dither=bayer:bayer_scale=4`;
        const ffmpeg = spawnSync('ffmpeg', ['-y', '-v', 'error', '-framerate', String(DEMO.fps / DEMO.every), '-i', path.join(dir, 'frame-%03d.png'), '-vf', filter, '-loop', '0', out]);
        if (ffmpeg.status !== 0) throw new Error(`ffmpeg failed: ${ffmpeg.stderr || ffmpeg.error}`);
        spawnSync('gifsicle', ['-O3', '--batch', out], { stdio: 'ignore' }); // fine if it's not installed
        save('assets/screenshots/demo.gif', fs.readFileSync(out));
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

async function makeDemo() {
    console.log('Demo GIF');
    if (spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).error) {
        console.log('  skipped: this needs ffmpeg on your PATH');
        return;
    }
    const server = await startStaticServer(root);
    try {
        const rate = (run) => (run.hits === 0 ? 1000 : 0) + run.gems * 10 + run.combo; // clean run, lots of treats, a nice combo
        let best = null;
        for (let seed = 1; seed <= 12; seed++) {
            const run = await playDemo(server, seed, { capture: false });
            console.log(`  seed ${seed}: ${run.hits} hits, ${run.gems} treats, best combo ${run.combo}x`);
            if (!best || rate(run) > rate(best)) best = { seed, ...run };
            if (run.hits === 0 && run.gems >= 6 && run.combo >= 4) break;
        }
        console.log(`  filming seed ${best.seed}`);
        const filmed = await playDemo(server, best.seed, { capture: true });
        if (filmed.hits !== best.hits || filmed.gems !== best.gems) console.log('  (note: the filmed run differs from its trial, so drawing changes the randomness)');
        assembleGif(filmed.frames);
    } finally {
        await server.stop();
    }
}

const only = process.argv[2]; // "icons", "screenshots" or "demo" to redo just that part
if (!only || only === 'icons') await makeIcons();
if (!only || only === 'screenshots') await makeScreenshots();
if (only === 'demo') await makeDemo(); // not part of the default run: it takes a couple of minutes
console.log('done');
