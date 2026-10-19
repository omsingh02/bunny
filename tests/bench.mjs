// bench.mjs - the benchmark. Measures the game against the budget in budget.mjs and prints the numbers:
//   - size: what the game's own files weigh when gzipped
//   - work: what a frame costs (draw calls, triangles, CPU time of update()) in seeded runs of every
//     difficulty, plus whether anything grows during a long run (a leak would)
// Run it alone with `npm run bench`; `npm test` runs it too. Like smoke.mjs it needs Chrome or Chromium
// (Three.js is downloaded once and reused; THREE_JS=/path/to/three.min.js when offline). Everything is seeded and stepped by hand at exactly
// 60 steps per game second, so the counts are the same on every machine; only the CPU time varies.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUDGET } from './budget.mjs';
import { ownGzipBytes } from './helpers/size.mjs';
import { startStaticServer } from './helpers/static-server.mjs';
import { CdpClient } from './helpers/cdp-client.mjs';
import { serveThree } from './helpers/three.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SEEDS = [1, 2, 3];
const DIFFICULTIES = ['easy', 'medium', 'hard'];
const RUN_MINUTES = 3;      // of game time, per seed and difficulty
const EVERY_SECOND = 60;    // draw a frame once per game second (60 steps)...
const EVERY_10_SECONDS = 600; // ...or once per ten, when only the totals matter
const LONG_RUN = { seed: 1, difficulty: 'hard', warmUpMinutes: 2, minutes: 10 };

// Runs inside the page. Plays `minutes` of game time with a simple autopilot that dodges obstacles, and reports
// what the renderer and the game did, drawing a frame every `renderEvery` steps. With restart: false it carries on
// the run that is already going.
async function simulate({ seed, difficulty, minutes, restart, renderEvery }) {
    const g = window.game;
    if (restart) {
        let s = seed; // the same seed always plays the same run (mulberry32)
        Math.random = () => {
            s = (s + 0x6D2B79F5) | 0;
            let t = Math.imul(s ^ (s >>> 15), 1 | s);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
        g.selectedDifficulty = difficulty;
        g.settings.sfxEnabled = g.settings.musicEnabled = false; // a headless page can't play sound, so notes would just pile up
        g.ui.startCountdown = async () => {}; // the 3-2-1 is only for humans
        g.animate = () => {};                 // the bench steps and draws by hand: the game's own frame loop must stay out of it
        g.gameOver = () => {};                // the autopilot is good, not perfect: carry on if it clips something
        await g.startGame();
        g.clock.getDelta = () => 1 / 60;
    }

    const maxSpeed = g.difficultyConfig[g.selectedDifficulty].maxSpeed;
    const out = { calls: 0, triangles: 0, sumCalls: 0, sumTriangles: 0, renders: 0, objects: 0, updateMs: 0, frames: 0, broken: null };

    for (let i = 0; i < minutes * 3600; i++) {
        const ahead = g.worldManager.obstacles.filter(o => o.position.z > -9 && o.position.z < 2);
        if (ahead.some(o => o.userData.lane === g.currentLane)) {
            const free = [g.currentLane - 1, g.currentLane + 1].filter(l => l >= 0 && l <= 2 && !ahead.some(o => o.userData.lane === l));
            if (free.length) g.moveLane(free[0] - g.currentLane); else g.jump();
        }

        const start = performance.now();
        g.update();
        out.updateMs += performance.now() - start;
        out.frames++;

        out.objects = Math.max(out.objects, g.scene.children.length);
        const { x, y, z } = g.bunny.position;
        if (!out.broken && !(Number.isFinite(x + y + z + g.speed + g.score) && y >= 0 && Math.abs(x) <= 2.01 && g.speed <= maxSpeed + 1e-9)) {
            out.broken = `after ${i} frames: bunny (${x}, ${y}, ${z}), speed ${g.speed}, score ${g.score}`;
        }

        if (i % renderEvery === 0) {
            g.renderer.render(g.scene, g.camera); // (this only queues the work: counting it is cheap, the software GPU is the slow part)
            const { calls, triangles } = g.renderer.info.render;
            out.calls = Math.max(out.calls, calls);
            out.triangles = Math.max(out.triangles, triangles);
            out.sumCalls += calls;
            out.sumTriangles += triangles;
            out.renders++;
        }
    }
    out.geometries = g.renderer.info.memory.geometries;
    return out;
}

const failures = [];
const rows = [];
function report(what, value, shown, limit, unit) {
    const ok = value <= limit;
    rows.push(`  ${ok ? '✔' : '✖'} ${what.padEnd(34)} ${shown.padStart(9)}  (budget ${limit} ${unit})`);
    if (!ok) failures.push(`${what} is ${shown}, over the budget of ${limit} ${unit}`);
}

// ---- size ------------------------------------------------------------------------------------
const size = ownGzipBytes(root);
const sizeKB = size.total / 1000;
report('own code, gzipped', sizeKB, sizeKB.toFixed(1) + ' kB', BUDGET.ownGzipKB, 'kB');
if (sizeKB > BUDGET.ownGzipKB) {
    const biggest = [...size.files].sort((a, b) => b.bytes - a.bytes).slice(0, 3).map(f => `${f.file} ${(f.bytes / 1000).toFixed(1)} kB`);
    failures.push(`the biggest files are ${biggest.join(', ')}`);
}

// ---- work ------------------------------------------------------------------------------------
const server = await startStaticServer(root);
const client = new CdpClient({ port: 9338 });
let runs = [];
let longRun = null;
try {
    await client.launch('about:blank', { width: 320, height: 180, isMobile: false }); // draw calls don't depend on the resolution
    await client.blockUrls(['https://a.omsingh.me/*']);
    await serveThree(client);
    await client.evalOnNewDocument(`window.umami = { track() {} };`);
    await client.goto(server.url + '/');
    await client.waitFor(`window.game?.gameState === 'menu'`, 30000);

    const play = (options) => client.evaluate(`(${simulate})(${JSON.stringify(options)})`);
    const heapMB = async () => {
        await client.send('HeapProfiler.enable');
        await client.send('HeapProfiler.collectGarbage');
        return (await client.send('Runtime.getHeapUsage')).usedSize / 1048576;
    };

    for (const seed of SEEDS) {
        for (const difficulty of DIFFICULTIES) {
            runs.push({ seed, difficulty, ...await play({ seed, difficulty, minutes: RUN_MINUTES, restart: true, renderEvery: EVERY_SECOND }) });
        }
    }

    // one long run: after a warm-up nothing may keep growing
    const { seed, difficulty, warmUpMinutes, minutes } = LONG_RUN;
    const warm = await play({ seed, difficulty, minutes: warmUpMinutes, restart: true, renderEvery: EVERY_SECOND });
    const heapBefore = await heapMB();
    const rest = await play({ seed, difficulty, minutes: minutes - warmUpMinutes, restart: false, renderEvery: EVERY_10_SECONDS });
    longRun = { warm, rest, heapGrowth: (await heapMB()) - heapBefore };
    runs.push({ seed, difficulty, ...warm }, { seed, difficulty, ...rest });

    const errors = client.pageErrors();
    if (errors.length) failures.push(`the page reported errors during the runs: ${errors[0]}`);
} finally {
    await client.close();
    server.close?.();
}

const sum = (key) => runs.reduce((total, r) => total + r[key], 0);
const peak = (key) => Math.max(...runs.map(r => r[key]));
const mean = (key) => sum(key) / sum('renders');

report('peak draw calls per frame', peak('calls'), String(peak('calls')), BUDGET.peakDrawCalls, 'calls');
report('peak triangles per frame', peak('triangles'), String(peak('triangles')), BUDGET.peakTriangles, 'triangles');
report('update() CPU time, mean', sum('updateMs') / sum('frames'), (sum('updateMs') / sum('frames')).toFixed(3) + ' ms', BUDGET.updateMs, 'ms');
report('geometries on the GPU', peak('geometries'), String(peak('geometries')), BUDGET.maxGeometries, 'geometries');
report('objects in the scene, peak', peak('objects'), String(peak('objects')), BUDGET.maxSceneObjects, 'objects');
report('heap growth, minute 2 to 10', longRun.heapGrowth, longRun.heapGrowth.toFixed(2) + ' MB', BUDGET.heapGrowthMB, 'MB');
if (longRun.rest.geometries !== longRun.warm.geometries) {
    failures.push(`geometries kept growing after the warm-up (${longRun.warm.geometries} -> ${longRun.rest.geometries}): something isn't pooled or disposed`);
}
for (const r of runs) {
    if (r.broken) failures.push(`${r.difficulty} seed ${r.seed}: the game broke its own rules ${r.broken}`);
}

console.log(`bench: ${runs.length} runs, ${sum('frames') / 3600} game minutes, ${sum('renders')} frames drawn`);
console.log(rows.join('\n'));
console.log(`  (typical frame: ${mean('sumCalls').toFixed(0)} draw calls, ${mean('sumTriangles').toFixed(0)} triangles. GPU time is not measured here)`);

if (failures.length) {
    console.error(`bench: ${failures.length} problem(s)\n` + failures.map(f => `  ✖ ${f}`).join('\n'));
    process.exit(1);
}
console.log('bench: within budget');
process.exit(0);
