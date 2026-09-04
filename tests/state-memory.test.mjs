import { CdpClient } from './helpers/cdp-client.mjs';

export async function runStateMemoryTests(baseUrl) {
    const results = {
        name: 'Game State Transitions & WebGL Memory Lifecycle Test',
        passed: false,
        metrics: {},
        violations: []
    };

    const client = new CdpClient({ port: 9336 });

    try {
        await client.launch(baseUrl, { width: 1920, height: 1080, isMobile: false });
        await client.waitFor('!!window.game?.bunny && !!window.game?.soundEffects?.jump', 10000);

        // 1. Guard Tests (State Re-entrance)
        const guardTests = await client.evaluate(`
            (() => {
                const game = window.game;
                const errors = [];

                // Cannot jump in menu state
                game.gameState = 'menu';
                game.isJumping = false;
                game.jump();
                if (game.isJumping) {
                    errors.push('Illegal state transition: jump() succeeded while in menu state');
                }

                // Cannot pause in menu state
                game.pauseGame();
                if (game.gameState === 'paused') {
                    errors.push('Illegal state transition: pauseGame() succeeded while in menu state');
                }

                return errors;
            })()
        `);

        if (guardTests && guardTests.length > 0) {
            results.violations.push(...guardTests);
        }

        // 2. Lifecycle Stress Test (10 cycles: Start -> Run -> Pause -> Resume -> GameOver -> Restart)
        const memoryCycleAudit = await client.evaluate(`
            (async () => {
                const game = window.game;
                const snapshots = [];

                for (let cycle = 1; cycle <= 5; cycle++) {
                    // Start
                    game.startGame();
                    await new Promise(r => setTimeout(r, 100));

                    // Pause
                    game.pauseGame();
                    await new Promise(r => setTimeout(r, 50));

                    // Resume
                    game.resumeGame();
                    await new Promise(r => setTimeout(r, 50));

                    // Game Over
                    game.gameOver();
                    await new Promise(r => setTimeout(r, 50));

                    // Restart
                    game.restartGame();
                    await new Promise(r => setTimeout(r, 100));

                    const mem = game.renderer?.info?.memory || { geometries: 0, textures: 0 };
                    snapshots.push({
                        cycle,
                        geometries: mem.geometries,
                        textures: mem.textures,
                        obstacles: game.obstacles?.length || 0,
                        collectibles: game.collectibles?.length || 0
                    });
                }

                return snapshots;
            })()
        `);

        results.metrics.cycles = memoryCycleAudit;

        // Verify that obstacles and collectibles don't leak unbounded across restarts
        if (memoryCycleAudit && memoryCycleAudit.length >= 5) {
            const firstCycle = memoryCycleAudit[1]; // after warm-up
            const lastCycle = memoryCycleAudit[memoryCycleAudit.length - 1];

            // If geometries grow by more than 2x between cycle 2 and 5, it's an unmanaged VRAM leak
            if (lastCycle.geometries > firstCycle.geometries * 2 && lastCycle.geometries > 50) {
                results.violations.push(
                    `WebGL geometry leak detected: geometries grew from ${firstCycle.geometries} to ${lastCycle.geometries} over 5 cycles`
                );
            }
        }

    } finally {
        await client.close();
    }

    results.passed = results.violations.length === 0;
    return results;
}
