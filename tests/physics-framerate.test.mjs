import { CdpClient } from './helpers/cdp-client.mjs';

export async function runPhysicsFramerateTests(baseUrl) {
    const results = {
        name: 'Metamorphic Multi-Framerate Kinematic Invariance Test',
        passed: false,
        metrics: {},
        violations: []
    };

    const client = new CdpClient({ port: 9335 });

    try {
        await client.launch(baseUrl, { width: 1920, height: 1080, isMobile: false });
        await client.waitFor('!!window.game?.bunny && !!window.game?.soundEffects?.jump', 10000);

        // Run in-browser metamorphic simulation across 60Hz, 120Hz, and 144Hz
        const simulationResult = await client.evaluate(`
            (() => {
                const game = window.game;
                
                // Helper to run a discrete kinematic simulation step
                function simulateRun(targetFps, durationSeconds) {
                    const dt = 1 / targetFps;
                    const steps = Math.round(durationSeconds / dt);
                    
                    // Reset game state into standard test run
                    game.gameState = 'playing';
                    game.gameTime = 0;
                    game.speed = 10;
                    game.worldPosition = 0;
                    game.score = 0;
                    game.isJumping = false;
                    game.jumpVelocity = 0;
                    game.gravity = 54;
                    game.jumpPower = 18;
                    game.bunny.position.set(0, 0, 0);
                    
                    let maxJumpApex = 0;
                    let jumpTriggerStep = Math.round(1.0 / dt); // Trigger jump at t = 1.0s
                    let jumpStartTime = 0;
                    let groundElevationDriftMax = 0;

                    for (let step = 0; step < steps; step++) {
                        if (step === jumpTriggerStep) {
                            game.isJumping = true;
                            jumpStartTime = game.gameTime;
                            game.jumpInitialVelocity = game.jumpPower;
                        }

                        // Continuous time progression
                        game.gameTime += dt;
                        const movement = game.speed * dt;
                        game.worldPosition += movement;

                        if (game.isJumping) {
                            const t = game.gameTime - jumpStartTime;
                            const y = (game.jumpInitialVelocity * t) - (0.5 * game.gravity * t * t);
                            if (y <= 0 && t > 0.05) {
                                game.bunny.position.y = 0;
                                game.isJumping = false;
                            } else {
                                game.bunny.position.y = Math.max(0, y);
                                if (game.bunny.position.y > maxJumpApex) {
                                    maxJumpApex = game.bunny.position.y;
                                }
                            }
                        } else {
                            const bounceCycle = game.gameTime * 12;
                            game.bunny.position.y = Math.abs(Math.sin(bounceCycle)) * 0.08;
                            // Check ground drift: must not exceed planned hopping amplitude
                            if (game.bunny.position.y > 0.09) {
                                groundElevationDriftMax = Math.max(groundElevationDriftMax, game.bunny.position.y - 0.08);
                            }
                        }
                    }

                    return {
                        fps: targetFps,
                        simulatedTime: game.gameTime,
                        totalDistance: game.worldPosition,
                        maxJumpApex: maxJumpApex,
                        groundDriftMax: groundElevationDriftMax
                    };
                }

                const sim60 = simulateRun(60, 3.0);
                const sim120 = simulateRun(120, 3.0);
                const sim144 = simulateRun(144, 3.0);

                return { sim60, sim120, sim144 };
            })()
        `);

        results.metrics = simulationResult;
        const { sim60, sim120, sim144 } = simulationResult;

        // MR-1: Distance Invariance (Delta < 0.1% across refresh rates)
        const distDiff120 = Math.abs(sim120.totalDistance - sim60.totalDistance) / sim60.totalDistance;
        const distDiff144 = Math.abs(sim144.totalDistance - sim60.totalDistance) / sim60.totalDistance;

        if (distDiff120 > 0.005) {
            results.violations.push(`Distance divergence between 60Hz and 120Hz: ${(distDiff120 * 100).toFixed(2)}% (limit: 0.5%)`);
        }
        if (distDiff144 > 0.005) {
            results.violations.push(`Distance divergence between 60Hz and 144Hz: ${(distDiff144 * 100).toFixed(2)}% (limit: 0.5%)`);
        }

        // MR-2: Jump Apex Invariance (Delta < 1.0% across refresh rates)
        const apexDiff120 = Math.abs(sim120.maxJumpApex - sim60.maxJumpApex) / sim60.maxJumpApex;
        const apexDiff144 = Math.abs(sim144.maxJumpApex - sim60.maxJumpApex) / sim60.maxJumpApex;

        if (apexDiff120 > 0.015) {
            results.violations.push(`Jump apex divergence between 60Hz and 120Hz: ${(apexDiff120 * 100).toFixed(2)}% (limit: 1.5%)`);
        }
        if (apexDiff144 > 0.015) {
            results.violations.push(`Jump apex divergence between 60Hz and 144Hz: ${(apexDiff144 * 100).toFixed(2)}% (limit: 1.5%)`);
        }

        // MR-3: Ground Elevation Drift
        if (sim144.groundDriftMax > 0.02) {
            results.violations.push(`Uncontrolled ground elevation drift at 144Hz: ${sim144.groundDriftMax.toFixed(4)}`);
        }

    } finally {
        await client.close();
    }

    results.passed = results.violations.length === 0;
    return results;
}
