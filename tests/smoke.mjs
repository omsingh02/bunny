// smoke.mjs - plays the real game in headless Chromium: menu, difficulty, countdown, keyboard,
// combo, pause, settings, game over, leaderboard, a reload, and a phone-sized run with touch input.
// Needs Chrome or Chromium (found automatically, or set CHROME_BIN) and internet (Three.js comes from a CDN),
// or THREE_JS=/path/to/three.min.js.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startStaticServer } from './helpers/static-server.mjs';
import { CdpClient } from './helpers/cdp-client.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const check = (ok, message) => {
    console.log(`  ${ok ? '✔' : '✖'} ${message}`);
    if (!ok) failures.push(message);
};
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const server = await startStaticServer(root);

async function open(viewport, { touch = false } = {}) {
    const client = new CdpClient({ port: 9335 });
    try {
        await client.launch('about:blank', viewport);
        await client.blockUrls(['https://a.omsingh.me/*']); // tests shouldn't talk to analytics
        // no internet? point THREE_JS at a local copy of three.min.js (r128) and the CDN request is answered from it
        if (process.env.THREE_JS) await client.serveFile('https://cdnjs.cloudflare.com/ajax/libs/three.js/*', process.env.THREE_JS);
        await client.evalOnNewDocument(`window.__events = []; window.umami = { track: (name, data) => window.__events.push({ name, data }) };`);
        if (touch) await client.setTouch(true);
        await client.goto(server.url + '/');
        await client.waitFor(`window.game?.gameState === 'menu'`, 30000);
        return client;
    } catch (error) {
        await client.close();
        throw error;
    }
}

// true if `expression` becomes truthy within the timeout
const eventually = (client, expression, timeout = 5000) => client.waitFor(expression, timeout).then(() => true, () => false);

async function desktopRun() {
    console.log('Desktop 1280x720');
    const c = await open({ width: 1280, height: 720, isMobile: false });
    try {
        // true if every button (and the best-score line) of a menu card is fully visible, i.e. nothing hides below the fold
        const fits = (card) => c.evaluate(`(() => {
            const card = document.querySelector('${card}');
            const bottom = card.getBoundingClientRect().top + card.clientTop + card.clientHeight;
            return [...card.querySelectorAll('button, .best-score-display')].every(el => el.getBoundingClientRect().bottom <= bottom + 0.5);
        })()`);

        // menu
        check(await c.evaluate(`document.getElementById('loading-screen').classList.contains('hidden')`), 'the loading screen gets out of the way');
        check(await fits('#main-menu .menu-content'), 'the whole main menu is visible in a 1280x720 window (no scrolling to reach Settings)');
        check(await c.evaluate(`document.getElementById('best-score-menu').textContent === String(game.bestScore)`), 'menu shows the best score');

        // difficulty selector
        const diff = await c.evaluate(`(() => {
            const click = (id) => document.getElementById(id).click();
            const card = () => [game.selectedDifficulty, document.getElementById('current-difficulty-name').textContent, document.getElementById('recommended-badge').classList.contains('show')];
            const out = { start: card() };
            click('difficulty-next'); out.hard = card();
            click('difficulty-prev'); click('difficulty-prev'); out.easy = card();
            click('difficulty-next'); out.medium = card();
            out.names = Object.fromEntries(Object.entries(game.difficultyConfig).map(([key, d]) => [key, d.name]));
            return out;
        })()`);
        check(diff.hard[0] === 'hard' && diff.hard[1] === diff.names.hard && !diff.hard[2], 'difficulty arrows: next goes to Hard and the card updates');
        check(diff.easy[0] === 'easy' && diff.easy[1] === diff.names.easy, 'difficulty arrows: prev goes back to Easy');
        check(diff.medium[0] === 'medium' && diff.start[0] === 'medium' && diff.medium[2] && diff.start[2], 'Medium shows the "Recommended" badge');

        const changes = await c.evaluate(`window.__events.filter(e => e.name === 'difficulty-change').map(e => e.data.from_difficulty + '>' + e.data.to_difficulty)`);
        check(changes.join(' ') === 'medium>hard hard>medium medium>easy easy>medium', `changing difficulty is tracked (${changes.join(', ')})`);

        // start (double click on purpose) and let the controls come alive
        await c.evaluate(`(() => {
            window.__countdowns = 0;
            const original = game.ui.startCountdown.bind(game.ui);
            game.ui.startCountdown = () => { window.__countdowns++; return original(); };
            game.gameOver = () => {};   // ignore crashes for now: the obstacles are random
            const start = document.getElementById('start-btn'); start.click(); start.click();
        })()`);
        const started = Date.now();
        check(await c.evaluate(`window.__countdowns === 1`), 'double-clicking START only starts one countdown');
        check(await eventually(c, `game.gameState === 'playing'`, 10000), 'the countdown hands over to the game');
        check(await c.evaluate(`JSON.stringify(window.__events.find(e => e.name === 'game-start')?.data) === JSON.stringify({ difficulty: 'medium', platform: 'desktop', audio_enabled: 'yes' })`),
            'starting a run sends the game-start event');
        check(Date.now() - started < 4000, `the countdown is quick (${Date.now() - started}ms)`);

        // keyboard
        await c.press('ArrowRight', 39);
        await c.press('ArrowRight', 39);
        check(await c.evaluate(`game.currentLane === 2`), 'ArrowRight moves to the right lane');
        await c.press('ArrowLeft', 37);
        check(await c.evaluate(`game.currentLane === 1`), 'ArrowLeft moves back');
        await c.press('Space', 32, ' ');
        check(await c.evaluate(`game.isJumping`), 'Space jumps');
        check(await eventually(c, `!game.isJumping`), 'the jump lands again');
        check(await c.evaluate(`game.score > 0`) || await eventually(c, `game.score > 0`), 'the distance score counts up');

        // combos: the 10x cap, then the HUD clears once the window lapses
        const combo = await c.evaluate(`(() => {
            game.collectWithCombo(); game.collectWithCombo(); game.collectWithCombo();
            const out = { count: game.comboCount, shown: getComputedStyle(document.getElementById('combo-display')).display };
            game.comboCount = 14; game.comboExpires = game.gameTime + 10;
            const before = game.score; game.collectWithCombo();
            out.pointsAtCombo15 = game.score - before;
            return out;
        })()`);
        check(combo.count === 3 && combo.shown !== 'none', 'three quick treats make a 3x combo and show it');
        check(combo.pointsAtCombo15 === 100, 'the combo multiplier stops at 10x');
        await c.evaluate(`game.comboExpires = 0`); // pretend the window ran out
        check(await eventually(c, `game.comboCount === 0 && getComputedStyle(document.getElementById('combo-display')).display === 'none'`),
            'the combo (and its HUD badge) expires when the window lapses');

        // pause menu shows the real numbers
        await c.evaluate(`document.getElementById('pause-btn').click()`);
        const pause = await c.evaluate(`({
            state: game.gameState, score: game.score, maxCombo: game.maxComboThisRun,
            shownScore: document.getElementById('pause-score').textContent, shownCombo: document.getElementById('pause-combo').textContent
        })`);
        check(pause.state === 'paused', 'the pause button pauses');
        check(await fits('#pause-menu .menu-content'), 'the whole pause menu is visible (RESTART and MAIN MENU too)');
        check(pause.shownScore === String(pause.score), `the pause menu shows the real score (${pause.shownScore})`);
        check(pause.shownCombo === pause.maxCombo + 'x', `the pause menu shows the best combo (${pause.shownCombo})`);

        // settings opened from the pause menu return to the pause menu
        const settings = await c.evaluate(`(() => {
            const visible = () => [...document.querySelectorAll('.screen')].filter(s => !s.classList.contains('hidden')).map(s => s.id);
            document.getElementById('pause-settings-btn').click(); const inSettings = visible();
            document.getElementById('settings-close-btn').click();
            return { inSettings, afterClose: visible(), state: game.gameState };
        })()`);
        check(settings.inSettings[0] === 'settings-screen' && settings.afterClose[0] === 'pause-menu' && settings.state === 'paused',
            'SAVE & CLOSE returns to the pause menu (the run is not lost)');
        await c.evaluate(`document.getElementById('resume-btn').click()`);
        check(await c.evaluate(`game.gameState === 'playing'`), 'resume continues the run');

        // switching tabs/apps pauses by itself
        await c.evaluate(`Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); 1`);
        check(await c.evaluate(`game.gameState === 'paused'`), 'switching to another tab pauses the game');
        await c.evaluate(`delete document.hidden; document.getElementById('resume-btn').click(); 1`);
        check(await c.evaluate(`game.gameState === 'playing'`), 'and it resumes afterwards');

        // settings: the toggle and the music button stay in sync and get saved
        await c.evaluate(`document.getElementById('sfx-setting').click(); document.getElementById('music-toggle').click();`);
        const toggled = await c.evaluate(`({
            sfx: game.settings.sfxEnabled, music: game.settings.musicEnabled,
            musicCheckbox: document.getElementById('music-setting').checked,
            musicButton: document.querySelector('#music-toggle span').textContent,
            saved: JSON.parse(localStorage.getItem('bunnyRunnerSettings'))
        })`);
        check(toggled.sfx === false && toggled.saved.sfxEnabled === false, 'the sound-effects toggle changes and saves the setting');
        check(toggled.music === false && toggled.musicCheckbox === false && toggled.musicButton === '♪', 'the HUD music button and the settings toggle stay in sync');

        // game over screen
        const over = await c.evaluate(`(() => {
            delete game.gameOver;   // use the real one again
            game.gameOver();
            return { state: game.gameState, score: game.score, best: game.bestScore,
                     shownScore: document.getElementById('final-score').textContent, shownBest: document.getElementById('best-score-final').textContent,
                     title: document.getElementById('game-over-title').textContent };
        })()`);
        check(over.state === 'gameOver', 'game over ends the run');
        check(over.shownScore === String(over.score) && over.shownBest === String(over.best), `game over shows your score (${over.shownScore}) and the best score (${over.shownBest})`);
        check(over.best >= over.score && over.title.includes('New Best'), 'a first run is a new best, and says so');
        const sent = await c.evaluate(`Object.fromEntries(window.__events.filter(e => ['game-over', 'high-score-new'].includes(e.name)).map(e => [e.name, e.data]))`);
        check(sent['game-over']?.score === over.score && sent['game-over']?.is_new_best === 'yes' && sent['game-over']?.cause === 'obstacle'
            && sent['game-over']?.duration_sec >= 1 && sent['game-over']?.max_combo >= 3 && sent['high-score-new']?.score === over.score,
            'game over sends the game-over and high-score-new events');

        // leaderboard: runs are kept per difficulty
        const board = await c.evaluate(`(() => {
            game.showMainMenu(); document.getElementById('leaderboard-btn').click();
            const rows = () => document.querySelectorAll('#leaderboard-list .leaderboard-entry').length;
            const tab = (d) => document.querySelector('.leaderboard-tab[data-difficulty="' + d + '"]').click();
            const out = { all: rows() }; tab('easy'); out.easy = rows(); tab('medium'); out.medium = rows();
            return out;
        })()`);
        check(board.all === 1 && board.medium === 1 && board.easy === 0, 'the leaderboard lists the run under All and Medium, and not under Easy');

        // second run: the countdown starts at 3 (not a leftover "GO!"), and idle screens stop re-rendering
        await c.evaluate(`game.showMainMenu(); document.getElementById('start-btn').click();`);
        check(await c.evaluate(`document.getElementById('countdown-number').textContent === '3'`), 'every countdown starts at 3');
        await c.evaluate(`game.gameState = 'menu'`); // (abandon that countdown's run for the idle check below)
        await sleep(500);
        const frames = await c.evaluate(`(async () => { const f = game.renderer.info.render.frame; await new Promise(r => setTimeout(r, 1000)); return game.renderer.info.render.frame - f; })()`);
        check(frames === 0, `idle screens don't keep re-rendering the scene (${frames} frames in 1s)`);

        // the error screen explains what went wrong
        const error = await c.evaluate(`(() => {
            game.ui.showError('Oops', 'something broke', new Error('boom'));
            const screen = document.getElementById('error-screen');
            return { shown: !screen.classList.contains('hidden'), message: document.getElementById('error-message').textContent,
                     details: document.getElementById('error-details').textContent, retry: !!document.getElementById('error-retry-btn') };
        })()`);
        check(error.shown && error.message === 'something broke' && error.details.includes('boom') && error.retry, 'the error screen shows the message, details and a retry button');

        // everything survives a reload
        await c.reload();
        await c.waitFor(`window.game?.gameState === 'menu'`, 20000);
        const saved = await c.evaluate(`({
            sfxToggle: document.getElementById('sfx-setting').checked, musicToggle: document.getElementById('music-setting').checked,
            musicButton: document.querySelector('#music-toggle span').textContent, settings: game.settings,
            best: document.getElementById('best-score-menu').textContent, bestScore: game.bestScore
        })`);
        check(saved.sfxToggle === false && saved.musicToggle === false && saved.musicButton === '♪', 'after a reload the settings screen shows the saved settings');
        check(saved.bestScore > 0 && saved.best === String(saved.bestScore), 'the best score survives a reload');

        check(c.pageErrors().length === 0, `no uncaught errors or console.error output ${c.pageErrors().join(' | ')}`);
    } finally {
        await c.close();
    }
}

async function phoneRun() {
    console.log('Phone 390x844 (touch)');
    const c = await open({ width: 390, height: 844, isMobile: true }, { touch: true });
    try {
        await c.evaluate(`game.gameOver = () => {}; document.getElementById('start-btn').click(); 1`);
        check(await eventually(c, `game.gameState === 'playing'`, 10000), 'the game starts');

        const hud = await c.evaluate(`(() => {
            const bar = document.getElementById('milestone-progress').getBoundingClientRect();
            return { left: bar.left, right: bar.right, width: innerWidth, touchButtons: getComputedStyle(document.getElementById('touch-controls')).display };
        })()`);
        check(hud.left >= -1 && hud.right <= hud.width + 1, `the milestone bar stays on screen (${Math.round(hud.left)}..${Math.round(hud.right)} of ${hud.width}px)`);
        check(hud.touchButtons !== 'none', 'the touch buttons show while playing');

        const swipe = async (x1, y1, x2, y2) => {
            await c.touch('touchStart', x1, y1);
            await c.touch('touchMove', (x1 + x2) / 2, (y1 + y2) / 2);
            await c.touch('touchMove', x2, y2);
            await c.touch('touchEnd', x2, y2);
        };
        await swipe(250, 400, 120, 400);
        check(await c.evaluate(`game.currentLane === 0`), 'swiping left moves to the left lane');
        await swipe(120, 400, 250, 400);
        await swipe(120, 400, 250, 400);
        check(await c.evaluate(`game.currentLane === 2`), 'swiping right (twice) moves to the right lane');
        await swipe(200, 500, 200, 350);
        check(await c.evaluate(`game.isJumping`), 'swiping up jumps');
        await eventually(c, `!game.isJumping`);
        await Promise.all([c.touch('touchStart', 200, 400), c.touch('touchEnd', 200, 400)]); // sent together: a real tap is quick
        check(await c.evaluate(`game.isJumping`), 'a quick tap jumps');
        await eventually(c, `!game.isJumping`);

        const button = async (id) => {
            const { x, y } = await c.evaluate(`(() => { const r = document.getElementById('${id}').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
            await c.touch('touchStart', x, y);
            await c.touch('touchEnd', x, y);
        };
        await button('touch-left');
        check(await c.evaluate(`game.currentLane === 1`), 'the on-screen left button moves a lane');

        check(c.pageErrors().length === 0, `no uncaught errors or console.error output ${c.pageErrors().join(' | ')}`);
    } finally {
        await c.close();
    }
}

try {
    await desktopRun();
    await phoneRun();
} catch (error) {
    failures.push(error.message);
    console.error(error);
} finally {
    await server.stop();
}

if (failures.length) {
    console.error(`\nsmoke: ${failures.length} check(s) failed`);
    process.exit(1);
}
console.log('\nsmoke: all good');
