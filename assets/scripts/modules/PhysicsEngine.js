// PhysicsEngine.js - jump arc, lane sliding and collision checks. All of it is a function of
// elapsed time, so the game plays the same at 60, 120 or 144 fps.
export class PhysicsEngine {
    static updateJump(game) {
        const bunny = game.bunny;

        if (game.isJumping) {
            const t = game.gameTime - game.jumpStartTime;
            const y = game.jumpPower * t - 0.5 * game.gravity * t * t;

            if (y <= 0 && t > 0.05) {
                bunny.position.y = 0;
                game.isJumping = false;
            } else {
                bunny.position.y = Math.max(0, y);
            }
        } else {
            // little hopping bounce while running (|sin| bounces ~3.8 times a second)
            bunny.position.y = Math.abs(Math.sin(game.gameTime * 12)) * 0.08;
        }

        // sway and tilt
        bunny.rotation.z = Math.sin(game.gameTime * 12) * 0.12;
        bunny.rotation.x = game.isJumping ? -0.3 : Math.sin(game.gameTime * 9) * 0.06;
    }

    static updateLane(game, deltaTime) {
        // lambda = 30 makes lane changes land in about 75ms
        game.bunny.position.x = THREE.MathUtils.damp(
            game.bunny.position.x,
            game.targetLanePosition,
            30,
            deltaTime
        );
    }

    // Returns the first thing the bunny is touching ({ type, index, ... }) or null.
    // Hitboxes are simple distance checks, a bit forgiving on purpose.
    static checkCollisions(game) {
        const { x, y, z } = game.bunny.position;
        const { obstacles, collectibles } = game.worldManager;

        for (const obstacle of obstacles) {
            if (Math.abs(x - obstacle.position.x) < 0.85 && Math.abs(z - obstacle.position.z) < 0.85 && y < 0.9) {
                return { type: 'obstacle', obstacle };
            }
        }

        for (let i = collectibles.length - 1; i >= 0; i--) {
            const collectible = collectibles[i];
            if (Math.abs(x - collectible.position.x) < 1.0 &&
                Math.abs(z - collectible.position.z) < 1.0 &&
                Math.abs((y + 0.8) - collectible.position.y) < 1.4) {
                return { type: 'collectible', index: i, collectible };
            }
        }

        return null;
    }
}
