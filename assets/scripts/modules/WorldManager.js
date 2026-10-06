// WorldManager.js - spawns obstacles, treats and scenery, scrolls them toward the bunny,
// and removes them once they're behind it. All models share pooled geometry (see ProceduralModels),
// so removing something from the scene is all the cleanup it needs.
import { ProceduralModels, GROUND_WIDTH } from './ProceduralModels.js';

const OBSTACLES = {
    flower: () => ProceduralModels.createFlower(),
    log: () => ProceduralModels.createLog(),
    rock: () => ProceduralModels.createRock()
};

const TREATS = {
    heart: () => ProceduralModels.createHeart(),
    star: () => ProceduralModels.createStar(),
    bunnyPlush: () => ProceduralModels.createBunnyPlush()
};

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const randomIn = ([min, max]) => min + Math.random() * (max - min);

export class WorldManager {
    constructor(scene, lanes) {
        this.scene = scene;
        this.lanes = lanes;

        this.obstacles = [];
        this.collectibles = [];
        this.decorations = [];

        this.obstacleSpawnDistance = 40;    // how far ahead of the bunny things appear
        this.collectibleSpawnDistance = 35;
        this.removalDistance = 10;          // obstacles and treats are dropped this far behind it
        this.maxObstacles = 8;
        this.maxCollectibles = 12;

        this.resetSpawnTimers();
    }

    resetSpawnTimers() {
        this.obstacleTimer = 0;             // ms since the last spawn
        this.collectibleTimer = 0;
        this.nextObstacleIn = 1500;         // ms until the next one
        this.nextCollectibleIn = 800;
    }

    createObstacle(z) {
        if (this.obstacles.length >= this.maxObstacles) return;

        const lane = Math.floor(Math.random() * this.lanes.length);
        const type = pick(Object.keys(OBSTACLES));
        const obstacle = OBSTACLES[type]();

        obstacle.position.set(this.lanes[lane], 0, z);
        obstacle.userData = { obstacleType: type, lane };

        this.obstacles.push(obstacle);
        this.scene.add(obstacle);
    }

    createCollectible(z) {
        // keep treats out of lanes that have an obstacle right there
        const blocked = new Set(
            this.obstacles.filter(o => Math.abs(o.position.z - z) < 5).map(o => o.userData.lane)
        );
        const allLanes = this.lanes.map((_, i) => i);
        const free = allLanes.filter(i => !blocked.has(i));
        const lane = pick(free.length ? free : allLanes);

        const collectible = TREATS[pick(Object.keys(TREATS))]();
        collectible.position.set(this.lanes[lane], 1.5, z);

        this.collectibles.push(collectible);
        this.scene.add(collectible);
    }

    removeCollectible(index) {
        const [collectible] = this.collectibles.splice(index, 1);
        this.scene.remove(collectible);
    }

    // Scatters grass and flowers over the meadow on both sides of the track
    generateDecorations(startZ, length) {
        ProceduralModels.initPools();
        const { geometries, materials } = ProceduralModels.pools;

        for (let i = 0; i < 8; i++) {
            const x = (Math.random() - 0.5) * (GROUND_WIDTH - 4);
            if (Math.abs(x) <= 4) continue; // keep the track itself clear
            const z = startZ - Math.random() * length;

            let decoration;
            if (Math.random() < 0.7) {
                decoration = new THREE.Mesh(geometries.grass, materials.grass);
                decoration.position.set(x, 0.25, z);
                decoration.rotation.y = Math.random() * Math.PI * 2;
            } else {
                decoration = ProceduralModels.createFlower();
                decoration.position.set(x, 0, z);
                decoration.scale.setScalar(0.7);
            }
            this.scene.add(decoration);
            this.decorations.push(decoration);
        }
    }

    updatePositions(movement, deltaTime) {
        for (const o of this.obstacles) o.position.z += movement;
        for (const c of this.collectibles) {
            c.position.z += movement;
            c.rotation.y += 3.0 * deltaTime;
        }
        for (const d of this.decorations) d.position.z += movement;
    }

    // `difficulty` is the active entry of the game's difficulty config (it holds the spawn intervals)
    updateSpawning(deltaTime, bunnyZ, difficulty) {
        const ms = deltaTime * 1000;

        this.obstacleTimer += ms;
        if (this.obstacleTimer >= this.nextObstacleIn) {
            this.createObstacle(bunnyZ - this.obstacleSpawnDistance);
            this.obstacleTimer = 0;
            this.nextObstacleIn = randomIn(difficulty.obstacleIntervalRange);
        }

        this.collectibleTimer += ms;
        if (this.collectibleTimer >= this.nextCollectibleIn) {
            if (this.collectibles.length < this.maxCollectibles) {
                this.createCollectible(bunnyZ - this.collectibleSpawnDistance);
            }
            this.collectibleTimer = 0;
            this.nextCollectibleIn = randomIn(difficulty.collectibleIntervalRange);
        }

        this.removePassed(bunnyZ);
    }

    // Drops everything that scrolled past `limit` from the scene and returns the rest
    sweep(list, limit) {
        return list.filter(obj => {
            if (obj.position.z <= limit) return true;
            this.scene.remove(obj);
            return false;
        });
    }

    removePassed(bunnyZ) {
        const limit = bunnyZ + this.removalDistance;
        this.obstacles = this.sweep(this.obstacles, limit);
        this.collectibles = this.sweep(this.collectibles, limit);
        this.decorations = this.sweep(this.decorations, bunnyZ + 20);
    }

    clear() {
        [...this.obstacles, ...this.collectibles, ...this.decorations].forEach(obj => this.scene.remove(obj));
        this.obstacles = [];
        this.collectibles = [];
        this.decorations = [];
        this.resetSpawnTimers();
    }
}
