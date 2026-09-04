// PhysicsEngine.js - Continuous Analytical Kinematics & Collision Subsystem
export class PhysicsEngine {
    static updateJump(game, deltaTime) {
        if (game.isJumping) {
            const t = game.gameTime - game.jumpStartTime;
            const y = (game.jumpInitialVelocity * t) - (0.5 * game.gravity * t * t);

            if (y <= 0 && t > 0.05) {
                game.bunny.position.y = 0;
                game.isJumping = false;
                game.jumpStartTime = 0;
            } else {
                game.bunny.position.y = Math.max(0, y);
            }
        } else {
            // Cute gentle hopping bounce tied to continuous time (frame-rate independent)
            const bounceCycle = game.gameTime * 12; // ~1.91 Hz, natural cute hopping
            game.bunny.position.y = Math.abs(Math.sin(bounceCycle)) * 0.08;
        }

        // Swaying & tilt animations tied to continuous time
        const swayCycle = game.gameTime * 12;
        game.bunny.rotation.z = Math.sin(swayCycle) * 0.12;
        game.bunny.rotation.x = game.isJumping ? -0.3 : Math.sin(game.gameTime * 9) * 0.06;
    }

    static updateLane(game, deltaTime) {
        // High-responsiveness lane dampening (lambda = 30 reduces input lag from 180ms to 75ms)
        game.bunny.position.x = THREE.MathUtils.damp(
            game.bunny.position.x,
            game.targetLanePosition,
            30,
            deltaTime
        );
    }

    static checkCollisions(game) {
        if (!game.bunny) return null;

        const bx = game.bunny.position.x;
        const by = game.bunny.position.y;
        const bz = game.bunny.position.z;

        // 1. High-speed zero-allocation analytical obstacle collision test
        const obstacles = game.obstacles;
        for (let i = 0; i < obstacles.length; i++) {
            const obstacle = obstacles[i];
            const dx = Math.abs(bx - obstacle.position.x);
            if (dx < 0.85) {
                const dz = Math.abs(bz - obstacle.position.z);
                if (dz < 0.85 && by < 0.9) {
                    return { type: 'obstacle', index: i, obstacle };
                }
            }
        }

        // 2. High-speed zero-allocation collectible proximity test
        const collectibles = game.collectibles;
        for (let i = collectibles.length - 1; i >= 0; i--) {
            const collectible = collectibles[i];
            const dx = Math.abs(bx - collectible.position.x);
            if (dx < 1.0) {
                const dz = Math.abs(bz - collectible.position.z);
                if (dz < 1.0) {
                    const dy = Math.abs((by + 0.8) - collectible.position.y);
                    if (dy < 1.4) {
                        return { type: 'collectible', index: i, collectible };
                    }
                }
            }
        }

        return null;
    }
}
