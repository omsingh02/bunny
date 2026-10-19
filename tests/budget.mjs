// budget.mjs - THE numbers. The game must stay under every one of these (tests/bench.mjs checks them,
// `npm test` runs it, and the README's "Budget" table is checked against this file).
//
// A budget is a ceiling, not a target: it sits a little above where the game is today, so a change that
// makes the game bigger or heavier has to be a decision, not an accident. Lower a number when the game gets
// leaner; raise one only on purpose, in the same pull request that needs it.
export const BUDGET = {
    // What a visitor downloads for the game itself: index.html + the stylesheet + every script, each gzipped on
    // its own (like a server sends them). Three.js (from a CDN) and the 40 KB font are not counted.
    ownGzipKB: 35, // 34 until the accessibility work (keyboard focus, reduced motion) added about 1 kB, on purpose

    // Work per frame while playing, counted by Three.js itself: draw calls (the shadow pass included)
    // and triangles. They don't depend on the machine, so they are a fair way to compare versions.
    // Peak = the busiest frame in a few seeded runs of every difficulty.
    peakDrawCalls: 140,
    peakTriangles: 18000,

    // Mean CPU time of one update() (spawning, movement, physics, scoring, HUD text). It is tiny today (about
    // 0.01 ms); the ceiling is far above that so a slow machine doesn't fail it, but a loop gone wrong does.
    updateMs: 0.2,

    // Things that must stop growing: geometries ever uploaded (the pools hold 25) and things in the scene
    maxGeometries: 30,
    maxSceneObjects: 60,

    // Heap growth between minute 2 and minute 10 of a run, after a garbage collection (about 0.1 today)
    heapGrowthMB: 1
};
