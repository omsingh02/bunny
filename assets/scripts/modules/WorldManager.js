// WorldManager.js - Procedural Chunk Generation, Continuous Spawning & GPU Memory Disposal
import { ProceduralModels } from './ProceduralModels.js';

export class WorldManager {
    constructor(scene, lanes) {
        this.scene = scene;
        this.lanes = lanes;

        this.obstacles = [];
        this.collectibles = [];
        this.decorations = [];

        this.obstacleSpawnTimer = 0;
        this.collectibleSpawnTimer = 0;
        this.nextObstacleSpawnTime = 1500;
        this.nextCollectibleSpawnTime = 800;
        this.obstacleSpawnDistance = 40;
        this.collectibleSpawnDistance = 35;
        this.obstacleRemovalDistance = 10;
        this.maxObstacles = 8;
        this.maxCollectibles = 12;
        this.totalObstaclesSpawned = 0;
        this.totalCollectiblesSpawned = 0;
    }

    createObstacle(z) {
        if (this.obstacles.length >= this.maxObstacles) return;

        const lane = Math.floor(Math.random() * 3);
        const x = this.lanes[lane];
        const types = ['flower', 'log', 'rock'];
        const type = types[Math.floor(Math.random() * types.length)];

        let obstacle;
        if (type === 'flower') obstacle = ProceduralModels.createFlower();
        else if (type === 'log') obstacle = ProceduralModels.createLog();
        else obstacle = ProceduralModels.createRock();

        obstacle.position.set(x, 0, z);
        obstacle.userData = {
            type: 'obstacle',
            obstacleType: type,
            lane: lane,
            spawnTime: Date.now()
        };

        this.obstacles.push(obstacle);
        this.scene.add(obstacle);
        this.totalObstaclesSpawned++;
    }

    createContinuousCollectible(z) {
        let availableLanes = [0, 1, 2];
        this.obstacles.forEach(obstacle => {
            const dist = Math.abs(obstacle.position.z - z);
            if (dist < 5 && obstacle.userData.lane !== undefined) {
                const idx = availableLanes.indexOf(obstacle.userData.lane);
                if (idx > -1) availableLanes.splice(idx, 1);
            }
        });
        if (availableLanes.length === 0) availableLanes = [0, 1, 2];

        const lane = availableLanes[Math.floor(Math.random() * availableLanes.length)];
        const x = this.lanes[lane];
        const types = ['heart', 'star', 'bunnyPlush'];
        const type = types[Math.floor(Math.random() * types.length)];

        let collectible;
        if (type === 'heart') collectible = ProceduralModels.createHeart();
        else if (type === 'star') collectible = ProceduralModels.createStar();
        else collectible = ProceduralModels.createBunnyPlush();

        collectible.position.set(x, 1.5, z);
        collectible.userData = {
            type: 'collectible',
            subType: type,
            lane: lane,
            spawnTime: Date.now()
        };

        this.collectibles.push(collectible);
        this.scene.add(collectible);
        this.totalCollectiblesSpawned++;
    }

    generateDecorations(startZ, length) {
        for (let i = 0; i < 8; i++) {
            const x = (Math.random() - 0.5) * 20;
            const z = startZ - Math.random() * length;

            if (Math.abs(x) > 4) {
                ProceduralModels.initPools();
                const isGrass = Math.random() < 0.7;
                if (isGrass) {
                    const grass = new THREE.Mesh(
                        ProceduralModels.pools.geometries.grass,
                        ProceduralModels.pools.materials.grass
                    );
                    grass.userData = { isPooled: true };
                    grass.position.set(x, 0.25, z);
                    grass.rotation.y = Math.random() * Math.PI * 2;
                    this.scene.add(grass);
                    this.decorations.push(grass);
                } else {
                    const flower = ProceduralModels.createFlower();
                    flower.position.set(x, 0, z);
                    flower.scale.setScalar(0.7);
                    this.scene.add(flower);
                    this.decorations.push(flower);
                }
            }
        }
    }

    generateWorldChunk(startZ) {
        this.generateDecorations(startZ, 20);
    }

    updatePositions(movement, deltaTime) {
        this.obstacles.forEach(o => { o.position.z += movement; });
        this.collectibles.forEach(c => {
            c.position.z += movement;
            c.rotation.y += 3.0 * deltaTime;
        });
        this.decorations.forEach(d => { d.position.z += movement; });
    }

    updateSpawning(deltaTime, bunnyZ, getObstacleInterval, getCollectibleInterval) {
        this.obstacleSpawnTimer += deltaTime * 1000;
        if (this.obstacleSpawnTimer >= this.nextObstacleSpawnTime) {
            const spawnZ = bunnyZ - this.obstacleSpawnDistance;
            this.createObstacle(spawnZ);
            this.obstacleSpawnTimer = 0;
            this.nextObstacleSpawnTime = getObstacleInterval();
        }

        this.collectibleSpawnTimer += deltaTime * 1000;
        if (this.collectibleSpawnTimer >= this.nextCollectibleSpawnTime) {
            if (this.collectibles.length < this.maxCollectibles) {
                const spawnZ = bunnyZ - this.collectibleSpawnDistance;
                this.createContinuousCollectible(spawnZ);
            }
            this.collectibleSpawnTimer = 0;
            this.nextCollectibleSpawnTime = getCollectibleInterval();
        }

        this.cleanupOldObjects(bunnyZ);
    }

    cleanupOldObjects(bunnyZ) {
        const threshold = bunnyZ + Math.abs(this.obstacleRemovalDistance);

        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            const o = this.obstacles[i];
            if (o.position.z > threshold) {
                ProceduralModels.disposeHierarchy(o);
                this.scene.remove(o);
                this.obstacles.splice(i, 1);
            }
        }

        for (let i = this.collectibles.length - 1; i >= 0; i--) {
            const c = this.collectibles[i];
            if (c.position.z > threshold) {
                ProceduralModels.disposeHierarchy(c);
                this.scene.remove(c);
                this.collectibles.splice(i, 1);
            }
        }

        const decThreshold = bunnyZ + 20;
        for (let i = this.decorations.length - 1; i >= 0; i--) {
            const d = this.decorations[i];
            if (d.position.z > decThreshold) {
                ProceduralModels.disposeHierarchy(d);
                this.scene.remove(d);
                this.decorations.splice(i, 1);
            }
        }
    }

    clear() {
        this.obstacles.forEach(o => {
            ProceduralModels.disposeHierarchy(o);
            this.scene.remove(o);
        });
        this.obstacles = [];

        this.collectibles.forEach(c => {
            ProceduralModels.disposeHierarchy(c);
            this.scene.remove(c);
        });
        this.collectibles = [];

        this.decorations.forEach(d => {
            ProceduralModels.disposeHierarchy(d);
            this.scene.remove(d);
        });
        this.decorations = [];
    }
}
