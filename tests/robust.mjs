// robust.mjs - what happens when the world isn't friendly. Each scenario loads the real game in headless
// Chromium with something broken (junk in localStorage, browser features that are missing or throw, no WebGL,
// Three.js failing to load, odd window sizes...) and checks the player is never left stuck: either the game
// plays on, or a friendly error screen with a working Retry button shows up.
// Needs Chrome or Chromium like smoke.mjs (Three.js is downloaded once and reused; THREE_JS=/path/to/three.min.js when offline).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startStaticServer } from './helpers/static-server.mjs';
import { CdpClient } from './helpers/cdp-client.mjs';
import { serveThree } from './helpers/three.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const check = (ok, message) => {
    console.log(`  ${ok ? '✔' : '✖'} ${message}`);
    if (!ok) failures.push(message);
};

const server = await startStaticServer(root);
const c = new CdpClient({ port: 9337 });

const DESKTOP = { width: 1280, height: 720, isMobile: false };
const PHONE = { width: 390, height: 844, isMobile: true };
const visible = (id) => `!document.getElementById('${id}').classList.contains('hidden')`;
const click = (id) => c.evaluate(`document.getElementById('${id}').click(); 1`);
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const eventually = (expression, timeout = 5000) => c.waitFor(expression, timeout).then(() => true, () => false);

// Every scenario starts from a fresh document with `setup` running before the game's own scripts. A scenario that
// blows up is reported as a failure and the next one still runs.
async function scenario(title, setup, body, viewport = DESKTOP) {
    console.log(title);
    let removeSetup = null;
    try {
        await c.goto('about:blank');
        await c.setViewport(viewport.width, viewport.height, viewport.isMobile);
        const id = await c.evalOnNewDocument(setup);
        removeSetup = () => c.removeOnNewDocument(id);
        c.events = [];
        await c.goto(server.url + '/');
        await body();
    } catch (error) {
        check(false, `${title}: the test stopped early (${error.message.split('\n')[0]})`);
    } finally {
        await removeSetup?.().catch(() => {});
    }
}

// true if the game reached its menu; the rest of a scenario is pointless if not
async function startsUp() {
    const ok = await eventually(`window.game?.gameState === 'menu'`, 20000);
    check(ok, 'the game starts up');
    return ok;
}

const noErrors = (what) => check(c.pageErrors().length === 0, `${what}: no uncaught errors${c.pageErrors().length ? ' (' + c.pageErrors()[0].split('\n')[0] + ')' : ''}`);

// A real run, with the real countdown: start, grab a treat, crash, and look at the game over screen and the leaderboard
async function playARun(what) {
    await click('start-btn');
    check(await eventually(`game.gameState === 'playing'`, 12000), `${what}: the countdown hands over to the game`);

    await c.evaluate(`(() => { const w = game.worldManager; w.createCollectible(0); w.collectibles.at(-1).position.set(game.bunny.position.x, 1.5, 0); })()`);
    check(await eventually(`game.gemsCollectedThisRun >= 1`), `${what}: a treat can be collected`);

    await eventually(`!game.isJumping`);   // hitboxes ignore a bunny in the air
    await c.evaluate(`(() => { const w = game.worldManager; w.createObstacle(0); w.obstacles.at(-1).position.set(game.bunny.position.x, 0, 0); })()`);
    check(await eventually(`game.gameState === 'gameOver' && ${visible('game-over')}`), `${what}: a crash ends the run and shows the game over screen`);

    await click('menu-return-btn');
    await click('leaderboard-btn');
    check(await eventually(`document.querySelectorAll('#leaderboard-list .leaderboard-entry').length === 1`), `${what}: the leaderboard lists the run`);
}

// An error screen with a message, a hidden loading screen and a Retry button that reloads the page
async function expectFriendlyError(what, messagePart) {
    check(await eventually(visible('error-screen'), 15000), `${what}: the error screen shows`);
    const message = await c.evaluate(`document.getElementById('error-message').textContent`);
    check(message.includes(messagePart), `${what}: it says what is wrong ("${message}")`);
    check(await c.evaluate(`document.getElementById('loading-screen').classList.contains('hidden')`), `${what}: the loading screen is gone`);
    await c.evaluate(`window.__beforeRetry = true; document.getElementById('error-retry-btn').click(); 1`);
    check(await eventually(`window.__beforeRetry === undefined`, 8000), `${what}: Retry reloads the page`);
}

const fakeAudio = (members) => `window.AudioContext = class { constructor() { this.state = 'running'; this.currentTime = 0; this.destination = {}; } resume() {} ${members} };`;
const quietNode = `{ connect() {}, disconnect() {}, gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {} } }`;

try {
    await c.launch('about:blank', DESKTOP);
    await c.blockUrls(['https://a.omsingh.me/*']);
    await serveThree(c);
    // the same start for every scenario: empty storage, and an analytics stub that records instead of sending
    await c.evalOnNewDocument(`try { localStorage.clear(); } catch {} window.umami = { track() {} };`);

    // (each kind of junk gets its own scenario: one that breaks the start-up would hide the others)
    await scenario('A saved achievements list that is just null', `localStorage.setItem('bunnyRunnerAchievements', 'null');`, async () => {
        if (!await startsUp()) return;
        noErrors('null achievements');
    });

    await scenario('Junk in localStorage (old versions, hand edits, other apps)', `
        localStorage.setItem('bunnyRunnerLeaderboard', '[null, 5, "x", {"score": "abc", "difficulty": "medium"}, {"score": 9, "difficulty": "bogus"}]');
        localStorage.setItem('bunnyRunnerSettings', '"abc"');
        localStorage.setItem('bunnyRunnerBestScore', '1e999');`, async () => {
        if (!await startsUp()) return;
        check(await c.evaluate(`Number.isFinite(game.bestScore) && document.getElementById('best-score-menu').textContent === String(game.bestScore)`), 'a nonsense best score becomes a normal number');
        check(await c.evaluate(`Object.values(game.settings).every(v => v === true)`), 'nonsense settings fall back to the defaults');
        await playARun('with junk saved');
        noErrors('with junk saved');
    });

    await scenario('A locked-down phone browser (private mode, no sound, no vibration, no fullscreen)', `
        Storage.prototype.getItem = Storage.prototype.setItem = Storage.prototype.removeItem = () => { throw new DOMException('denied', 'SecurityError'); };
        window.AudioContext = window.webkitAudioContext = undefined;
        navigator.vibrate = undefined;
        delete Element.prototype.requestFullscreen;
        Document.prototype.exitFullscreen = undefined;`, async () => {
        if (!await startsUp()) return;
        await click('fullscreen-toggle');
        await playARun('locked down');
        noErrors('locked down');
    }, PHONE);

    await scenario('Sound, vibration and analytics that throw', `
        ${fakeAudio(`createOscillator() { throw new DOMException('closed', 'InvalidStateError'); } createGain() { return ${quietNode}; } createBiquadFilter() { return ${quietNode}; }`)}
        navigator.vibrate = () => { throw new Error('vibration refused'); };
        window.umami = { track() { throw new Error('analytics blocked'); } };`, async () => {
        if (!await startsUp()) return;
        await playARun('with throwing extras');
        noErrors('with throwing extras');
    });

    await scenario('Audio that the OS interrupts (iOS), then RESUME', '', async () => {
        if (!await startsUp()) return;
        check(await c.evaluate(`(() => {
            game.audio.enableAudio();
            let wakeUps = 0;
            Object.defineProperty(game.audio.ctx, 'state', { configurable: true, get: () => 'interrupted' });
            game.audio.ctx.resume = () => { wakeUps++; return Promise.resolve(); };
            game.gameState = 'paused';
            document.getElementById('resume-btn').click();
            return wakeUps >= 1;
        })()`), 'tapping RESUME wakes the audio up');
        noErrors('audio resume');
    });

    // (the stub makes `typeof THREE` undefined, which is all a failed script load changes)
    await scenario('Three.js never arrives (CDN blocked or offline)', `Object.defineProperty(window, 'THREE', { get: () => undefined, set: () => {}, configurable: true });`, async () => {
        await expectFriendlyError('no Three.js', 'Three.js');
        noErrors('no Three.js');
    });

    await scenario('No WebGL', `HTMLCanvasElement.prototype.getContext = () => null;`, async () => {
        await expectFriendlyError('no WebGL', 'WebGL');
        noErrors('no WebGL');
    });

    await scenario('The WebGL context is lost and restored (a phone in the background)', '', async () => {
        if (!await startsUp()) return;
        await c.evaluate(`(() => {
            window.__draws = 0;
            const draw = game.renderer.render.bind(game.renderer);
            game.renderer.render = (...args) => { window.__draws++; return draw(...args); };
            window.__lose = game.renderer.getContext().getExtension('WEBGL_lose_context');
            window.__lose.loseContext();
        })()`);
        await sleep(300);
        await c.evaluate(`window.__draws = 0; window.__lose.restoreContext(); 1`);
        check(await eventually(`window.__draws >= 1`), 'the menu is painted again once the context is back');
        noErrors('context loss');
    });

    await scenario('Odd window sizes', '', async () => {
        if (!await startsUp()) return;
        for (const [width, height] of [[1, 1], [5000, 20], [20, 5000], [390, 844]]) {
            await c.setViewport(width, height, false);
            await sleep(150);
            check(await c.evaluate(`[...game.camera.projectionMatrix.elements].every(Number.isFinite)`), `${width}x${height}: the camera stays sane`);
        }
        noErrors('odd sizes');
    });

    await scenario('The tab is hidden during the countdown', '', async () => {
        if (!await startsUp()) return;
        await c.evaluate(`document.getElementById('start-btn').click(); Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); 1`);
        check(await eventually(`game.gameState === 'paused'`, 8000), 'the run starts paused instead of running into things unseen');
        noErrors('hidden countdown');
    });

    await scenario('Physics limits', '', async () => {
        if (!await startsUp()) return;
        // a lag spike is capped at 50 ms per step; at top speed that is 1.3 units, less than a hitbox is wide
        const skipped = JSON.parse(await c.evaluate(`(async () => {
            const g = game;
            g.ui.startCountdown = async () => {};
            g.selectedDifficulty = 'hard';
            const skippedOver = [];
            for (const kind of ['obstacle', 'treat']) {
                for (let offset = 0; offset < 1.4; offset += 0.1) {
                    await g.startGame();
                    g.clock.getDelta = () => 0.05;
                    const w = g.worldManager;
                    w.nextObstacleIn = w.nextCollectibleIn = 1e9;  // nothing else spawns
                    let crashed = 0;
                    g.gameOver = () => { crashed++; };
                    g.score = 20000;                                // top speed
                    if (kind === 'obstacle') { w.createObstacle(-6 - offset); w.obstacles[0].position.x = 0; }
                    else { w.createCollectible(-6 - offset); w.collectibles[0].position.x = 0; }
                    for (let i = 0; i < 20; i++) g.update();
                    if (kind === 'obstacle' ? crashed === 0 : g.gemsCollectedThisRun === 0) skippedOver.push(kind + ' at +' + offset.toFixed(1));
                }
            }
            return JSON.stringify(skippedOver);
        })()`));
        check(skipped.length === 0, `a 50 ms step at top speed never skips over an obstacle or a treat${skipped.length ? ' (missed: ' + skipped.join(', ') + ')' : ''}`);
        noErrors('physics limits');
    });

    await scenario('3000 random inputs', '', async () => {
        if (!await startsUp()) return;
        const fuzz = JSON.parse(await c.evaluate(`(async () => {
            const g = game;
            g.ui.startCountdown = async () => {};
            await g.startGame();
            g.clock.getDelta = () => 1 / 60;
            let seed = 12345;
            const random = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
            const keys = ['ArrowLeft', 'ArrowRight', 'Space', 'ArrowUp', 'KeyA', 'KeyD', 'KeyW', 'Escape'];
            const broken = [];
            let crashes = 0;
            for (let i = 0; i < 3000 && !broken.length; i++) {
                const roll = random();
                if (roll < 0.5) document.dispatchEvent(new KeyboardEvent('keydown', { code: keys[Math.floor(random() * keys.length)] }));
                else if (roll < 0.55) g.pauseGame();
                else if (roll < 0.65) g.resumeGame();
                else if (roll < 0.66) g.startGame();
                else if (roll < 0.67) g.showMainMenu();

                const before = g.score;
                const wasPlaying = g.gameState === 'playing';
                g.update();
                const { x, y, z } = g.bunny.position;
                if (![x, y, z, g.speed, g.score].every(Number.isFinite)) broken.push('a number went NaN or infinite at step ' + i);
                if (y < 0 || y > 3 || Math.abs(x) > 2.01) broken.push('the bunny left its track at step ' + i + ' (' + x + ', ' + y + ')');
                if (g.speed > g.difficultyConfig[g.selectedDifficulty].maxSpeed + 1e-9) broken.push('speed went over the top speed at step ' + i);
                if (wasPlaying && g.gameState === 'playing' && g.score < before) broken.push('the score went down at step ' + i);
                if (g.gameState === 'gameOver') { crashes++; g.showMainMenu(); await g.startGame(); }
            }
            return JSON.stringify({ broken, crashes });
        })()`));
        check(fuzz.broken.length === 0, `the game keeps its rules through key mashing, pausing and restarting (${fuzz.crashes} crashes along the way)${fuzz.broken.length ? ': ' + fuzz.broken[0] : ''}`);
        noErrors('random inputs');
    });
} finally {
    await c.close();
    server.close?.();
}

if (failures.length) {
    console.error(`\nrobust: ${failures.length} problem(s)\n` + failures.map(f => `  ✖ ${f}`).join('\n'));
    process.exit(1);
}
console.log('\nrobust: all good');
process.exit(0);
