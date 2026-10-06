// Bunny Runner - the game itself: state, scoring and the main loop.
// The pieces (audio, models, world, physics, input, UI...) live in ./modules.

import { AudioSynth } from "./modules/AudioSynth.js";
import { ProceduralModels } from "./modules/ProceduralModels.js";
import { ParticleSystem } from "./modules/ParticleSystem.js";
import { StorageManager } from "./modules/StorageManager.js";
import { PhysicsEngine } from "./modules/PhysicsEngine.js";
import { WorldManager } from "./modules/WorldManager.js";
import { InputController } from "./modules/InputController.js";
import { UIController } from "./modules/UIController.js";
import { AnalyticsManager } from "./modules/AnalyticsManager.js";
import { $ } from "./modules/dom.js";

// Achievement name -> "has the player earned it right now?"
const ACHIEVEMENT_RULES = {
    firstJump: (g) => g.isJumping,
    score100: (g) => g.score >= 100,
    score500: (g) => g.score >= 500,
    score1000: (g) => g.score >= 1000,
    combo5: (g) => g.comboCount >= 5,
    combo10: (g) => g.comboCount >= 10,
    noHit50: (g) => g.score >= 50 && g.obstacleHitsThisRun === 0,
    speedDemon: (g) => g.speed >= g.difficultyConfig[g.selectedDifficulty].maxSpeed
};

export class BunnyRunnerGame {
    constructor() {
        window.game = this; // handy for poking around in the browser console

        this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
        this.isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0;

        // loading -> menu -> countdown -> playing <-> paused -> gameOver -> (menu | countdown)
        this.gameState = "loading";
        this.score = 0;
        this.scoreTimer = 0;
        this.gameTime = 0;            // seconds of actual play (pauses with the game)
        this.clock = new THREE.Clock();
        this.renderPending = true;    // the scene is only redrawn on idle screens when this is set

        // Movement (tuned for a snappy arcade feel: ~470ms jump, ~75ms lane change)
        this.lanes = [-2, 0, 2];
        this.currentLane = 1;
        this.targetLanePosition = 0;
        this.speed = 12;
        this.baseSpeed = 12;
        this.speedIncrement = 0.12;
        this.isJumping = false;
        this.jumpStartTime = 0;
        this.jumpPower = 16;
        this.gravity = 68;
        this.worldPosition = 0;       // distance since the last scenery chunk was added

        // Combos & milestones
        this.comboCount = 0;
        this.comboExpires = 0;        // gameTime when the current combo runs out
        this.comboTimeout = 3;        // seconds to grab the next treat
        this.maxComboThisRun = 0;
        this.gemsCollectedThisRun = 0;
        this.obstacleHitsThisRun = 0;
        this.lastMilestone = 0;
        this.milestones = [100, 250, 500, 750, 1000, 1500, 2000, 3000, 5000];

        this.selectedDifficulty = "medium";
        this.difficultyConfig = {
            easy: {
                name: "Relaxed Garden Stroll",
                description: "Slow, gentle & relaxing",
                icon: "🌸",
                baseSpeed: 9,
                maxSpeed: 16,
                speedIncrement: 0.08,
                obstacleIntervalRange: [2000, 3500],
                collectibleIntervalRange: [800, 1500]
            },
            medium: {
                name: "Bunny Hop Fun",
                description: "Balanced fun & challenge!",
                icon: "💕",
                baseSpeed: 12,
                maxSpeed: 20,
                speedIncrement: 0.12,
                obstacleIntervalRange: [1500, 2800],
                collectibleIntervalRange: [1000, 2000]
            },
            hard: {
                name: "Speedy Meadow Dash",
                description: "Fast! For brave bunnies!",
                icon: "⚡",
                baseSpeed: 15,
                maxSpeed: 26,
                speedIncrement: 0.18,
                obstacleIntervalRange: [1000, 2000],
                collectibleIntervalRange: [1200, 2200]
            }
        };

        // Saved progress
        this.settings = StorageManager.loadSettings();
        this.bestScore = StorageManager.getBestScore();
        this.leaderboard = StorageManager.loadLeaderboard();
        this.achievements = StorageManager.loadAchievements({
            firstJump: { title: "First Hop!", desc: "Jumped for the very first time! 🐰" },
            score100: { title: "Getting Started", desc: "Reached 100 points! 🌟" },
            score500: { title: "Bunny Master", desc: "Reached 500 points! 🏆" },
            score1000: { title: "Legendary Runner", desc: "Reached 1000 points! 👑" },
            combo5: { title: "Combo Novice", desc: "Got a 5x combo! ✨" },
            combo10: { title: "Combo Master", desc: "Got a 10x combo! 💫" },
            noHit50: { title: "Untouchable", desc: "Reached 50 points without hitting obstacles! 🛡️" },
            speedDemon: { title: "Speed Demon", desc: "Reached maximum speed! ⚡" }
        });

        // Three.js objects (created in init)
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.bunny = null;
        this.particleSystem = null;
        this.worldManager = null;

        this.audio = new AudioSynth(this);
        this.input = new InputController(this);
        this.ui = new UIController(this);

        this.init();
    }

    get platform() {
        return this.isMobile ? "mobile" : "desktop";
    }

    // ---- setup ---------------------------------------------------------------------------

    init() {
        try {
            this.setupThreeJS();
            this.setupLights();
            this.scene.add(ProceduralModels.createGround(this.lanes));
            this.bunny = ProceduralModels.createBunny();
            this.scene.add(this.bunny);

            this.input.init();
            this.ui.init();
            this.ui.syncSettings(this.settings);
            this.setupPageEvents();

            this.showMainMenu();
            this.animate();
        } catch (error) {
            this.ui.showError("Initialization Error", error.message, error);
        } finally {
            $("loading-screen").classList.add("hidden");
        }
    }

    setupThreeJS() {
        if (!this.checkWebGLSupport()) {
            throw new Error("WebGL is not supported in your browser.");
        }

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB);
        this.scene.fog = new THREE.Fog(0x87CEEB, 10, 50);

        this.camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({
            canvas: $("game-canvas"),
            antialias: !this.isMobile,
            powerPreference: "high-performance"
        });
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.handleResize(); // sizes the renderer and frames the camera

        this.particleSystem = new ParticleSystem(this.scene);
        this.worldManager = new WorldManager(this.scene, this.lanes);
    }

    setupLights() {
        const shadowSize = this.isMobile ? 512 : 1024;

        this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));

        const sun = new THREE.DirectionalLight(0xffffff, 0.8);
        sun.position.set(5, 10, 5);
        sun.castShadow = true;
        sun.shadow.mapSize.set(shadowSize, shadowSize);
        sun.shadow.camera.near = 0.5;
        sun.shadow.camera.far = 30;
        sun.shadow.camera.left = -4;
        sun.shadow.camera.right = 4;
        sun.shadow.camera.top = 4;
        sun.shadow.camera.bottom = -4;
        sun.shadow.bias = -0.0005;
        this.scene.add(sun);

        const fill = new THREE.DirectionalLight(0xFFB6C1, 0.3);
        fill.position.set(-5, 5, 2);
        this.scene.add(fill);
    }

    // Things that listen to the whole page
    setupPageEvents() {
        window.addEventListener("resize", () => this.handleResize());
        document.addEventListener("visibilitychange", () => {
            if (document.hidden) this.pauseGame(); // switched tab/app: don't let the bunny run into things
        });
        window.addEventListener("appinstalled", () => AnalyticsManager.trackPwaInstalled(this.platform));
        if (this.isTouchDevice) {
            document.addEventListener("contextmenu", (e) => e.preventDefault()); // no long-press menu while playing
        }
    }

    handleResize() {
        const aspect = window.innerWidth / window.innerHeight;
        this.camera.aspect = aspect;
        this.camera.fov = aspect < 1 ? 85 : 75;
        this.camera.updateProjectionMatrix();

        // narrow screens get a higher, further-back camera
        if (aspect < 0.8) {
            this.camera.position.set(0, 6, 8);
            this.camera.lookAt(0, 0, -3);
        } else {
            this.camera.position.set(0, 4, 6);
            this.camera.lookAt(0, 0, -5);
        }

        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.isMobile ? 1.5 : 2));
        this.renderPending = true;
    }

    checkWebGLSupport() {
        try {
            const canvas = document.createElement("canvas");
            return !!(window.WebGLRenderingContext && (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")));
        } catch {
            return false;
        }
    }

    // ---- game lifecycle ------------------------------------------------------------------

    // An empty meadow: no obstacles, treats or sparkles, plus a fresh patch of scenery
    resetWorld() {
        this.worldManager.clear();
        this.particleSystem.clear();
        for (let i = 0; i < 3; i++) {
            this.worldManager.generateDecorations(i * 20 - 10, 20);
        }
        this.bunny.position.set(0, 0, 0);
        this.bunny.rotation.set(0, 0, 0);
    }

    async startGame() {
        if (this.gameState === "countdown") return; // ignore double clicks
        this.gameState = "countdown";
        this.audio.enableAudio(); // must happen inside the click that started the game

        this.score = 0;
        this.scoreTimer = 0;
        this.gameTime = 0;
        this.worldPosition = 0;
        this.currentLane = 1;
        this.targetLanePosition = 0;
        this.isJumping = false;
        this.comboCount = 0;
        this.comboExpires = 0;
        this.maxComboThisRun = 0;
        this.gemsCollectedThisRun = 0;
        this.obstacleHitsThisRun = 0;
        this.lastMilestone = 0;
        this.applyDifficultySettings();

        this.resetWorld();
        for (let i = 0; i < 3; i++) {
            this.worldManager.createCollectible(-15 - i * 8);
        }

        this.ui.showScreen("game-hud");
        this.updateScore();
        this.ui.updateMilestoneProgress(0, 0, this.milestones[0]);
        this.audio.startBackgroundMusic();

        AnalyticsManager.trackGameStart({
            difficulty: this.selectedDifficulty,
            platform: this.platform,
            audioEnabled: this.settings.sfxEnabled || this.settings.musicEnabled
        });

        await this.ui.startCountdown();

        this.clock.getDelta(); // the countdown doesn't count as play time
        this.gameState = "playing";
        if (document.hidden) this.pauseGame();
    }

    showMainMenu() {
        this.gameState = "menu";
        this.audio.stopBackgroundMusic();
        this.resetWorld();
        this.ui.showMainMenu(this.bestScore);
    }

    pauseGame() {
        if (this.gameState !== "playing") return;
        this.gameState = "paused";
        this.audio.stopBackgroundMusic();
        this.ui.updatePauseMenuStats(this.score, this.maxComboThisRun);
        this.ui.showScreen("pause-menu");
    }

    resumeGame() {
        if (this.gameState !== "paused") return;
        this.clock.getDelta(); // skip the time spent paused
        this.gameState = "playing";
        this.audio.startBackgroundMusic();
        this.ui.showScreen("game-hud");
    }

    gameOver(cause = "obstacle") {
        this.gameState = "gameOver";
        this.audio.stopBackgroundMusic();

        const isNewBest = this.score > this.bestScore;
        if (isNewBest) {
            this.bestScore = this.score;
            StorageManager.saveBestScore(this.score);
            AnalyticsManager.trackHighScore(this.score, this.selectedDifficulty);
        }
        this.audio.play(isNewBest ? "milestone" : "gameOver");

        AnalyticsManager.trackGameOver({
            difficulty: this.selectedDifficulty,
            score: this.score,
            gems: this.gemsCollectedThisRun,
            cause,
            maxCombo: Math.max(1, this.maxComboThisRun),
            isNewBest
        });

        this.leaderboard = StorageManager.addToLeaderboard(this.leaderboard, this.score, this.selectedDifficulty);
        this.ui.showGameOver(this.score, this.bestScore, isNewBest);
    }

    // ---- player actions ------------------------------------------------------------------

    moveLane(dir) {
        const lane = Math.max(0, Math.min(this.lanes.length - 1, this.currentLane + dir));
        if (lane === this.currentLane) return;
        this.currentLane = lane;
        this.targetLanePosition = this.lanes[lane];
    }

    jump() {
        if (this.gameState !== "playing" || this.isJumping) return;
        this.isJumping = true;
        this.jumpStartTime = this.gameTime;
        this.audio.play("jump");
    }

    // ---- main loop -----------------------------------------------------------------------

    animate() {
        requestAnimationFrame(() => this.animate());
        this.update();
        // While playing the scene changes every frame; on menus it only needs a redraw when something changed
        if (this.gameState === "playing" || this.renderPending) {
            this.renderPending = false;
            this.renderer.render(this.scene, this.camera);
        }
    }

    update() {
        if (this.gameState !== "playing") return;

        const deltaTime = Math.min(this.clock.getDelta(), 0.05); // a lag spike can't teleport the bunny
        this.gameTime += deltaTime;

        const movement = this.speed * deltaTime;
        this.worldPosition += movement;

        const config = this.difficultyConfig[this.selectedDifficulty];
        const world = this.worldManager;
        world.updateSpawning(deltaTime, this.bunny.position.z, config);
        world.updatePositions(movement, deltaTime);
        if (this.worldPosition >= 20) { // every 20 units, add more scenery up ahead
            world.generateDecorations(-40, 20);
            this.worldPosition -= 20;
        }

        PhysicsEngine.updateLane(this, deltaTime);
        PhysicsEngine.updateJump(this);

        // distance score: 10 points per second, added in 0.1s ticks
        this.scoreTimer += deltaTime;
        if (this.scoreTimer >= 0.1) {
            this.score += Math.round(this.scoreTimer * 10);
            this.scoreTimer = 0;
            this.updateScore();
            this.checkMilestone();
        }

        // the combo lapses if you don't grab another treat in time
        if (this.comboCount && this.gameTime >= this.comboExpires) {
            this.comboCount = 0;
            this.updateScore();
        }

        // the game speeds up with your score, up to this difficulty's top speed
        this.speed = Math.min(this.baseSpeed + this.score * this.speedIncrement * 0.1, config.maxSpeed);

        const hit = PhysicsEngine.checkCollisions(this);
        if (hit?.type === "obstacle") {
            this.obstacleHitsThisRun++;
            this.input.triggerHapticFeedback("heavy");
            this.gameOver(hit.obstacle.userData.obstacleType);
        } else if (hit?.type === "collectible") {
            this.collectWithCombo();
            this.input.triggerHapticFeedback("success");
            this.particleSystem.createSparkleEffect(hit.collectible.position, this.settings.particlesEnabled);
            world.removeCollectible(hit.index);
        }

        this.particleSystem.update(deltaTime);
        this.checkAchievements();
    }

    collectWithCombo() {
        this.comboCount = this.gameTime < this.comboExpires ? this.comboCount + 1 : 1;
        this.comboExpires = this.gameTime + this.comboTimeout;
        this.maxComboThisRun = Math.max(this.maxComboThisRun, this.comboCount);
        this.gemsCollectedThisRun++;

        const points = 10 * Math.min(this.comboCount, 10); // the multiplier tops out at 10x
        this.score += points;
        this.updateScore();
        this.audio.play(this.comboCount >= 5 ? "milestone" : "collect");

        if (this.comboCount > 1) {
            this.ui.showComboFeedback(this.comboCount, points);
        }
        this.checkMilestone();
    }

    checkMilestone() {
        const next = this.milestones.find(m => m > this.lastMilestone);
        if (!next) return;

        this.ui.updateMilestoneProgress(this.score, this.lastMilestone, next);
        if (this.score >= next) {
            this.lastMilestone = next;
            this.audio.play("milestone");
        }
    }

    updateScore() {
        this.ui.updateScore(this.score, this.bestScore, this.comboCount);
    }

    checkAchievements() {
        for (const [key, earned] of Object.entries(ACHIEVEMENT_RULES)) {
            if (!this.achievements[key].unlocked && earned(this)) this.unlockAchievement(key);
        }
    }

    unlockAchievement(key) {
        const achievement = this.achievements[key];
        achievement.unlocked = true;
        StorageManager.saveAchievements(this.achievements);
        this.ui.showAchievementToast(achievement.title, achievement.desc);
    }

    // ---- settings & difficulty -----------------------------------------------------------

    setSetting(key, value) {
        this.settings[key] = value;
        StorageManager.saveSettings(this.settings);
        this.ui.syncSettings(this.settings);

        if (key === "musicEnabled") {
            if (!value) this.audio.stopBackgroundMusic();
            else if (this.gameState === "playing") this.audio.startBackgroundMusic();
        }
    }

    changeDifficulty(dir) {
        const keys = Object.keys(this.difficultyConfig);
        const index = Math.max(0, Math.min(keys.length - 1, keys.indexOf(this.selectedDifficulty) + dir));
        if (keys[index] === this.selectedDifficulty) return;

        const previous = this.selectedDifficulty;
        this.selectedDifficulty = keys[index];
        AnalyticsManager.trackDifficultyChange(previous, this.selectedDifficulty);
        this.ui.updateDifficultyDisplay();
    }

    applyDifficultySettings() {
        const config = this.difficultyConfig[this.selectedDifficulty];
        this.baseSpeed = config.baseSpeed;
        this.speedIncrement = config.speedIncrement;
        this.speed = this.baseSpeed;
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
        } else {
            document.exitFullscreen().catch(() => {});
        }
    }
}

// This file is loaded as a module, so the page is already parsed by the time it runs
new BunnyRunnerGame();
