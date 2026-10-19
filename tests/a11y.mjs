// a11y.mjs - can the game be used without a mouse, and without the motion? Drives the real game in headless
// Chromium with real key presses and mouse clicks and checks:
//   - Tab only ever lands on what is on screen (hidden screens keep their buttons out of the Tab order)
//   - Enter and Space during a run never press a leftover button (Enter used to restart the run)
//   - keyboard players land on the title of each new screen, mouse and touch players see no change
//   - "reduce motion" in the system settings stops the idle animations
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
const c = new CdpClient({ port: 9343 });

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const eventually = (expression, timeout = 5000) => c.waitFor(expression, timeout).then(() => true, () => false);
const ENTER = ['Enter', 13, 'Enter', '\r'];
const SPACE = ['Space', 32, ' ', ' '];
const TAB = ['Tab', 9];
const ESCAPE = ['Escape', 27];

// a fresh document, at the main menu and settled (the loading screen has faded out)
async function freshMenu() {
    await c.goto('about:blank');
    c.events = [];
    await c.goto(server.url + '/');
    const ok = await eventually(`window.game?.gameState === 'menu'`, 30000);
    const why = ok ? '' : ` (state: ${await c.evaluate(`window.game?.gameState`).catch(() => '?')}, Three.js: ${await c.evaluate(`typeof THREE`).catch(() => '?')}, page says: ${JSON.stringify(await c.evaluate(`document.getElementById('error-message')?.textContent`).catch(() => '?'))}, errors: ${c.pageErrors().length})`;
    check(ok, `the game starts up${why}`);
    await sleep(900);
    return ok;
}

// what has keyboard focus, in words
const focused = () => c.evaluate(`(() => { const e = document.activeElement; return e === document.body ? 'nothing' : (e.id || e.tagName + ' "' + e.textContent.trim().slice(0, 24) + '"'); })()`);

try {
    await c.launch('about:blank', { width: 1280, height: 720, isMobile: false });
    await c.blockUrls(['https://a.omsingh.me/*']);
    await serveThree(c);
    await c.evalOnNewDocument(`window.umami = { track() {} };`);

    // ---- Tab only reaches what is on screen -------------------------------------------------
    console.log('Tabbing around the main menu');
    if (await freshMenu()) {
        const reachable = await c.evaluate(`[...document.querySelectorAll('.screen.hidden :is(button, input, a[href], [tabindex])')]
            .filter(el => !el.closest('[inert]')).map(el => el.id)`);
        check(reachable.length === 0, `no control on a hidden screen can take focus${reachable.length ? ' (' + reachable.join(', ') + ')' : ''}`);
        const shown = await c.evaluate(`[...document.querySelectorAll('.screen:not(.hidden)')].map(el => el.id + (el.inert ? ' (inert!)' : ''))`);
        check(shown.length === 1 && shown[0] === 'main-menu', `exactly one screen is live, the main menu (${shown.join(', ')})`);

        const seen = [];
        for (let i = 0; i < 12; i++) {
            await c.press(...TAB);
            seen.push(await c.evaluate(`(() => { const e = document.activeElement; return e.closest('.screen.hidden') ? 'HIDDEN:' + e.id : e.id; })()`));
        }
        check(!seen.some(id => id.startsWith('HIDDEN:')), `Tab never lands on a hidden screen (visited: ${[...new Set(seen)].join(', ')})`);
        for (const id of ['difficulty-prev', 'difficulty-next', 'start-btn', 'how-to-play-btn', 'leaderboard-btn', 'settings-btn']) {
            check(seen.includes(id), `Tab reaches ${id}`);
        }
    }

    // ---- Enter and Space during a run ---------------------------------------------------------
    console.log('Playing with the keyboard');
    if (await freshMenu()) {
        await c.evaluate(`window.__starts = 0; const start = game.startGame.bind(game); game.startGame = (...args) => { window.__starts++; return start(...args); }; document.getElementById('start-btn').focus(); 1`);
        await c.press(...ENTER); // presses START with the keyboard
        check(await eventually(`game.gameState === 'playing'`, 15000), 'Enter on START starts a run (3-2-1 and all)');
        check(await focused() === 'nothing', `no button keeps focus once the run has started (focus: ${await focused()})`);

        await c.press(...ENTER);
        await c.press(...SPACE);
        await sleep(300);
        check(await c.evaluate('window.__starts') === 1, 'Enter and Space during the run do not start it over');
        check(await c.evaluate(`game.gameState`) === 'playing', 'the run carries on');

        // pause with Escape: focus goes to the title, Tab reaches RESUME, Enter resumes
        await c.press(...ESCAPE);
        check(await eventually(`game.gameState === 'paused'`), 'Escape pauses');
        check((await focused()).includes('Paused'), `focus moves to the pause title (focus: ${await focused()})`);
        await c.press(...TAB);
        check(await focused() === 'resume-btn', `Tab then reaches RESUME (focus: ${await focused()})`);
        await c.press(...ENTER);
        check(await eventually(`game.gameState === 'playing'`, 15000), 'Enter on RESUME resumes the run');

        // crash while mashing the jump key: the new screen must not be pressed by the next Space
        const startsBefore = await c.evaluate('window.__starts');
        await c.evaluate(`game.gameOver(); 1`);
        check(await eventually(`game.gameState === 'gameOver'`), 'the run ends');
        check(await focused() === 'game-over-title', `focus moves to the game over title, not to a button (focus: ${await focused()})`);
        await c.press(...SPACE);
        await c.press(...SPACE);
        await c.press(...ENTER);
        await sleep(300);
        check(await c.evaluate('window.__starts') === startsBefore && await c.evaluate('game.gameState') === 'gameOver', 'Space and Enter right after a crash do not restart by accident');
        await c.press(...TAB);
        check(await focused() === 'play-again-btn', `Tab then reaches PLAY AGAIN (focus: ${await focused()})`);
        check(c.pageErrors().length === 0, `no uncaught errors${c.pageErrors().length ? ' (' + c.pageErrors()[0].split('\n')[0] + ')' : ''}`);
    }

    // ---- Mouse and touch players see no change ------------------------------------------------
    console.log('Clicking with the mouse');
    if (await freshMenu()) {
        const { x, y } = await c.evaluate(`(() => { const r = document.getElementById('how-to-play-btn').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
        await c.mouseClick(x, y);
        check(await eventually(`!document.getElementById('tutorial-screen').classList.contains('hidden')`), 'a click opens the tutorial');
        check(await focused() === 'nothing', `a click leaves no focus ring behind (focus: ${await focused()})`);
    }

    // ---- Reduce motion ---------------------------------------------------------------------------
    console.log('Asking for reduced motion');
    const looping = `document.getAnimations().filter(a => a.playState === 'running' && a.effect?.getComputedTiming().iterations === Infinity).length`;
    if (await freshMenu()) {
        const before = await c.evaluate(looping);
        check(before > 0, `by default the menu has idle animations (${before} looping), so the next check means something`);

        await c.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
        await sleep(300);
        const after = await c.evaluate(looping);
        check(after === 0, `with "reduce motion" on, nothing loops (${after} looping)`);
        check(await c.evaluate(`getComputedStyle(document.querySelector('.confetti')).display`) === 'none', 'the confetti is gone');
        await c.send('Emulation.setEmulatedMedia', { features: [] });
    }
} finally {
    await c.close();
    server.close?.();
}

if (failures.length) {
    console.error(`\na11y: ${failures.length} problem(s)\n` + failures.map(f => `  ✖ ${f}`).join('\n'));
    process.exit(1);
}
console.log('\na11y: all good');
process.exit(0);
