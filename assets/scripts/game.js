// Bunny Runner - Modular Game Engine Coordinator
// Architecture: Gregory (Game Engine Architecture) & Fowler (Refactoring)

import { AudioSynth } from "./modules/AudioSynth.js";
import { ProceduralModels } from "./modules/ProceduralModels.js";
import { ParticleSystem } from "./modules/ParticleSystem.js";
import { StorageManager } from "./modules/StorageManager.js";
import { PhysicsEngine } from "./modules/PhysicsEngine.js";
import { WorldManager } from "./modules/WorldManager.js";
import { InputController } from "./modules/InputController.js";
import { UIController } from "./modules/UIController.js";
import { AnalyticsManager } from "./modules/AnalyticsManager.js";

export class BunnyRunnerGame {
    constructor() {
        window.game = this;

        // Platform detection
        this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
        this.isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0;

        // Core state
        this.gameState = "loading"; // loading, menu, playing, paused, gameOver
        this.score = 0;
        this.scoreTimer = 0;
        this.frameCount = 0;
        this.gameTime = 0;
        this.clock = new THREE.Clock();

        // Physics parameters (tuned for snappy arcade kinesthetics: 470ms jump, 75ms lane transition)
        this.lanes = [-2, 0, 2];
        this.currentLane = 1;
        this.targetLanePosition = 0;
        this.speed = 12;
        this.baseSpeed = 12;
        this.speedIncrement = 0.12;
        this.jumpVelocity = 0;
        this.isJumping = false;
        this.jumpStartTime = 0;
        this.jumpInitialVelocity = 16;
        this.jumpPower = 16;
        this.gravity = 68;
        this.worldPosition = 0;

        // Combo & milestones
        this.comboCount = 0;
        this.comboTimer = 0;
        this.comboTimeout = 3000;
        this.lastComboTime = 0;
        this.maxComboThisRun = 0;
        this.lastMilestone = 0;
        this.milestones = [100, 250, 500, 750, 1000, 1500, 2000, 3000, 5000];
        this.obstacleHitsThisRun = 0;

        // Difficulty configuration
        this.selectedDifficulty = "medium";
        this.difficultyConfig = {
            easy: {
                name: "Relaxed Garden Stroll",
                description: "Gentle speed, fewer obstacles - perfect for enjoying the scenery!",
                icon: "🌸",
                badge: "Relaxed",
                badgeClass: "easy",
                baseSpeed: 9,
                maxSpeed: 16,
                speedIncrement: 0.08,
                obstacleIntervalRange: [2000, 3500],
                collectibleIntervalRange: [800, 1500]
            },
            medium: {
                name: "Bunny Hop Fun",
                description: "The classic cute adventure! Balanced challenge with plenty of treats.",
                icon: "💕",
                badge: "Classic",
                badgeClass: "medium",
                baseSpeed: 12,
                maxSpeed: 20,
                speedIncrement: 0.12,
                obstacleIntervalRange: [1500, 2800],
                collectibleIntervalRange: [1000, 2000]
            },
            hard: {
                name: "Speedy Meadow Dash",
                description: "Fast-paced excitement! Quick reflexes needed for brave bunnies!",
                icon: "⚡",
                badge: "Speedy",
                badgeClass: "hard",
                baseSpeed: 15,
                maxSpeed: 26,
                speedIncrement: 0.18,
                obstacleIntervalRange: [1000, 2000],
                collectibleIntervalRange: [1200, 2200]
            }
        };

        // Achievement definitions
        this.achievements = {
            firstJump: { title: "First Hop!", desc: "Jumped for the very first time! 🐰", unlocked: false },
            score100: { title: "Getting Started", desc: "Reached 100 points! 🌟", unlocked: false },
            score500: { title: "Bunny Master", desc: "Reached 500 points! 🏆", unlocked: false },
            score1000: { title: "Legendary Runner", desc: "Reached 1000 points! 👑", unlocked: false },
            combo5: { title: "Combo Novice", desc: "Got a 5x combo! ✨", unlocked: false },
            combo10: { title: "Combo Master", desc: "Got a 10x combo! 💫", unlocked: false },
            noHit50: { title: "Untouchable", desc: "Reached 50 points without hitting obstacles! 🛡️", unlocked: false },
            speedDemon: { title: "Speed Demon", desc: "Reached maximum speed! ⚡", unlocked: false }
        };

        // Load persistence
        this.settings = StorageManager.loadSettings();
        this.bestScore = StorageManager.getBestScore();
        this.leaderboard = StorageManager.loadLeaderboard();
        this.achievements = StorageManager.loadAchievements(this.achievements);

        // Three.js scene references
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.bunny = null;

        // Subsystems
        this.audio = new AudioSynth(this);
        this.particles = [];
        this.particleSystem = null;
        this.worldManager = null;
        this.input = new InputController(this);
        this.ui = new UIController(this);

        // Sound effects facade for backwards compatibility
        this.soundEffects = {};

        this.init();
    }

    // Property facades for tests and backwards compatibility
    get obstacles() { return this.worldManager ? this.worldManager.obstacles : []; }
    set obstacles(val) { if (this.worldManager) this.worldManager.obstacles = val; }

    get collectibles() { return this.worldManager ? this.worldManager.collectibles : []; }
    set collectibles(val) { if (this.worldManager) this.worldManager.collectibles = val; }

    get decorations() { return this.worldManager ? this.worldManager.decorations : []; }
    set decorations(val) { if (this.worldManager) this.worldManager.decorations = val; }

    get audioListener() { return this.audio.audioListener; }
    get audioEnabled() { return this.audio.audioEnabled; }
    set audioEnabled(val) { this.audio.audioEnabled = val; }
    get musicEnabled() { return this.audio.musicEnabled; }
    set musicEnabled(val) { this.audio.musicEnabled = val; }

    async init() {
        try {
            document.addEventListener("contextmenu", (e) => { e.preventDefault(); return false; });

            await this.loadingSequence();
            this.setupThreeJS();
            this.audio.init(this.camera);
            this.soundEffects = this.audio.soundEffects;

            this.createWorld();
            this.createBunny();
            this.setupLights();

            this.input.init();
            this.ui.init();
            AnalyticsManager.init();
            this.applySettings();
            this.setupPWA();

            this.showMainMenu();
            this.animate();
        } catch (error) {
            this.showError("Initialization Error", error.message, error);
        }
    }

    async loadingSequence() {
        const loadingProgress = document.getElementById("loading-progress");
        for (let i = 0; i <= 100; i += 10) {
            if (loadingProgress) loadingProgress.style.width = i + "%";
            await new Promise(r => setTimeout(r, 20));
        }
        await new Promise(r => setTimeout(r, 200));
        document.getElementById("loading-screen")?.classList.add("hidden");
        await new Promise(r => setTimeout(r, 200));
    }

    setupThreeJS() {
        if (!this.checkWebGLSupport()) {
            throw new Error("WebGL is not supported in your browser.");
        }

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB);
        this.scene.fog = new THREE.Fog(0x87CEEB, 10, 50);

        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new THREE.PerspectiveCamera(aspect < 1 ? 85 : 75, aspect, 0.1, 1000);
        if (aspect < 0.8) {
            this.camera.position.set(0, 6, 8);
            this.camera.lookAt(0, 0, -3);
        } else {
            this.camera.position.set(0, 4, 6);
            this.camera.lookAt(0, 0, -5);
        }

        const canvas = document.getElementById("game-canvas");
        this.renderer = new THREE.WebGLRenderer({
            canvas,
            antialias: !this.isMobile,
            powerPreference: "high-performance"
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.isMobile ? 1.5 : 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // Initialize subsystems requiring scene
        this.particleSystem = new ParticleSystem(this.scene);
        this.particles = this.particleSystem.particles;
        this.worldManager = new WorldManager(this.scene, this.lanes);

        window.addEventListener("resize", () => this.handleResize());
    }

    setupLights() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(5, 10, 5);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = this.isMobile ? 512 : 1024;
        directionalLight.shadow.mapSize.height = this.isMobile ? 512 : 1024;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 30;
        directionalLight.shadow.camera.left = -4;
        directionalLight.shadow.camera.right = 4;
        directionalLight.shadow.camera.top = 4;
        directionalLight.shadow.camera.bottom = -4;
        directionalLight.shadow.bias = -0.0005;
        this.scene.add(directionalLight);

        const fillLight = new THREE.DirectionalLight(0xFFB6C1, 0.3);
        fillLight.position.set(-5, 5, 2);
        this.scene.add(fillLight);
    }

    createWorld() {
        const groundGroup = ProceduralModels.createGround(this.lanes);
        this.scene.add(groundGroup);
        for (let i = 0; i < 3; i++) {
            this.worldManager.generateWorldChunk(i * 20 - 10);
        }
    }

    createBunny() {
        this.bunny = ProceduralModels.createBunny();
        this.scene.add(this.bunny);
    }

    // Audio delegation
    enableAudio() { this.audio.enableAudio(); }
    startBackgroundMusic() { this.audio.startBackgroundMusic(); }
    stopBackgroundMusic() { this.audio.stopBackgroundMusic(); }
    toggleMusic() { this.audio.toggleMusic(); }

    // Game lifecycle
    async startGame() {
        this.score = 0;
        this.speed = this.baseSpeed;
        this.worldPosition = 0;
        this.currentLane = 1;
        this.targetLanePosition = 0;
        this.isJumping = false;
        this.jumpVelocity = 0;
        this.scoreTimer = 0;
        this.gameTime = 0;

        this.clock.getDelta();
        this.comboCount = 0;
        this.lastMilestone = 0;
        this.obstacleHitsThisRun = 0;

        this.applyDifficultySettings();
        this.bunny.position.set(0, 0, 0);

        this.clearWorld();

        for (let i = 0; i < 3; i++) {
            this.worldManager.generateDecorations(i * 20 - 10, 20);
        }
        for (let i = 0; i < 3; i++) {
            this.worldManager.createContinuousCollectible(-15 - (i * 8));
        }

        this.showScreen("game-hud");
        this.updateScore();
        this.ui.updateMilestoneProgress(0, 0, this.milestones[0]);

        if (this.settings.musicEnabled && this.audio.audioEnabled) {
            this.startBackgroundMusic();
        }

        this.gemsCollectedThisRun = 0;
        AnalyticsManager.trackGameStart({
            difficulty: this.selectedDifficulty,
            platform: this.isMobile ? "mobile" : "desktop",
            audioEnabled: this.settings.soundEnabled || this.audio.audioEnabled
        });

        await this.ui.startCountdown();
        this.gameState = "playing";
    }

    restartGame() {
        this.clearWorld();
        this.stopBackgroundMusic();
        this.enableAudio();
        this.startGame();
    }

    showMainMenu() {
        this.gameState = "menu";
        this.stopBackgroundMusic();
        this.clearWorld();

        const menuBest = document.getElementById("best-score-menu");
        if (menuBest) menuBest.textContent = this.bestScore;

        this.showScreen("main-menu");
    }

    clearWorld() {
        if (this.worldManager) this.worldManager.clear();
        if (this.particleSystem) this.particleSystem.clear();
    }

    pauseGame() {
        if (this.gameState === "playing") {
            this.gameState = "paused";
            this.stopBackgroundMusic();
            this.ui.updatePauseMenuStats(this.score, this.bestScore, this.speed);
            this.showScreen("pause-menu");
        }
    }

    resumeGame() {
        if (this.gameState === "paused") {
            this.clock.getDelta();
            this.gameState = "playing";
            if (this.settings.musicEnabled && this.audio.audioEnabled) {
                this.startBackgroundMusic();
            }
            this.showScreen("game-hud");
        }
    }

    gameOver(cause = "obstacle") {
        this.gameState = "gameOver";
        this.stopBackgroundMusic();
        if (this.audio.soundEffects?.gameOver) this.audio.soundEffects.gameOver();

        const isNewBest = this.score > this.bestScore;
        if (isNewBest) {
            this.bestScore = this.score;
            StorageManager.saveBestScore(this.bestScore);
            AnalyticsManager.trackHighScore(this.score, this.selectedDifficulty);
        }

        AnalyticsManager.trackGameOver({
            difficulty: this.selectedDifficulty,
            score: this.score,
            gems: this.gemsCollectedThisRun || 0,
            cause,
            maxCombo: this.maxComboThisRun || 1,
            isNewBest
        });

        this.leaderboard = StorageManager.addToLeaderboard(this.leaderboard, this.score, this.selectedDifficulty);
        this.saveSettings();

        const finalScore = document.getElementById("final-score");
        if (finalScore) finalScore.textContent = this.score;
        const finalBest = document.getElementById("final-best-score");
        if (finalBest) finalBest.textContent = this.bestScore;

        this.showScreen("game-over");
    }

    moveLane(dir) {
        const newLane = Math.max(0, Math.min(2, this.currentLane + dir));
        if (newLane !== this.currentLane) {
            this.currentLane = newLane;
            this.targetLanePosition = this.lanes[this.currentLane];
        }
    }

    jump() {
        if (this.gameState !== "playing" || this.isJumping) return;
        this.isJumping = true;
        this.jumpStartTime = this.gameTime;
        this.jumpInitialVelocity = this.jumpPower;
        this.audio.soundEffects?.jump?.();
    }

    update() {
        if (this.gameState !== "playing") return;

        let deltaTime = Math.min(this.clock.getDelta(), 0.05);
        this.frameCount++;
        this.gameTime += deltaTime;

        const movement = this.speed * deltaTime;
        this.worldPosition += movement;

        // Subsystem updates
        this.worldManager.updateSpawning(
            deltaTime,
            this.bunny.position.z,
            () => this.getRandomObstacleInterval(),
            () => this.getRandomCollectibleInterval()
        );
        this.worldManager.updatePositions(movement, deltaTime);

        if (this.worldPosition >= 20) {
            this.worldManager.generateWorldChunk(-40);
            this.worldPosition -= 20;
        }

        PhysicsEngine.updateLane(this, deltaTime);
        PhysicsEngine.updateJump(this, deltaTime);

        // Scoring
        this.scoreTimer += deltaTime;
        if (this.scoreTimer >= 0.1) {
            this.score += Math.round(this.scoreTimer * 10);
            this.scoreTimer = 0;
            this.updateScore();
            this.checkMilestone();
        }

        // Speed ramp
        const config = this.difficultyConfig[this.selectedDifficulty];
        this.speed = Math.min(this.baseSpeed + (this.score * this.speedIncrement * 0.1), config.maxSpeed);

        // Collisions
        const collision = PhysicsEngine.checkCollisions(this);
        if (collision) {
            if (collision.type === "obstacle") {
                this.obstacleHitsThisRun++;
                this.input.triggerHapticFeedback("heavy");
                const cause = collision.obstacle?.userData?.obstacleType || "obstacle";
                this.gameOver(cause);
            } else if (collision.type === "collectible") {
                this.collectWithCombo();
                this.input.triggerHapticFeedback("success");
                this.createSparkleEffect(collision.collectible.position);
                ProceduralModels.disposeHierarchy(collision.collectible);
                this.scene.remove(collision.collectible);
                this.worldManager.collectibles.splice(collision.index, 1);
            }
        }

        this.particleSystem.update(deltaTime);
        this.checkAchievements();
    }

    collectWithCombo() {
        const now = Date.now();
        if (now - this.lastComboTime < this.comboTimeout) {
            this.comboCount++;
        } else {
            this.comboCount = 1;
        }
        this.lastComboTime = now;
        this.gemsCollectedThisRun = (this.gemsCollectedThisRun || 0) + 1;
        if (this.comboCount > this.maxComboThisRun) this.maxComboThisRun = this.comboCount;

        const pts = 10 * this.comboCount;
        this.score += pts;
        this.updateScore();
        this.audio.soundEffects?.collect?.();

        if (this.comboCount > 1) {
            this.ui.showComboFeedback(this.comboCount, pts);
        }
    }

    checkMilestone() {
        const next = this.milestones.find(m => m > this.lastMilestone);
        if (next) {
            this.ui.updateMilestoneProgress(this.score, this.lastMilestone, next);
            if (this.score >= next) {
                this.lastMilestone = next;
                this.audio.soundEffects?.milestone?.();
            }
        }
    }

    createSparkleEffect(pos) {
        this.particleSystem.createSparkleEffect(pos, this.settings.particlesEnabled);
    }

    checkAchievements() {
        if (!this.achievements.firstJump.unlocked && this.isJumping) this.unlockAchievement("firstJump");
        if (!this.achievements.score100.unlocked && this.score >= 100) this.unlockAchievement("score100");
        if (!this.achievements.score500.unlocked && this.score >= 500) this.unlockAchievement("score500");
        if (!this.achievements.score1000.unlocked && this.score >= 1000) this.unlockAchievement("score1000");
        if (!this.achievements.combo5.unlocked && this.comboCount >= 5) this.unlockAchievement("combo5");
        if (!this.achievements.combo10.unlocked && this.comboCount >= 10) this.unlockAchievement("combo10");
        if (!this.achievements.noHit50.unlocked && this.score >= 50 && this.obstacleHitsThisRun === 0) this.unlockAchievement("noHit50");
        if (!this.achievements.speedDemon.unlocked && this.speed >= this.difficultyConfig[this.selectedDifficulty].maxSpeed) this.unlockAchievement("speedDemon");
    }

    unlockAchievement(key) {
        if (!this.achievements[key] || this.achievements[key].unlocked) return;
        this.achievements[key].unlocked = true;
        StorageManager.saveAchievements(this.achievements);
        this.ui.showAchievementToast(this.achievements[key].title, this.achievements[key].desc);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.update();
        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }

    handleResize() {
        const aspect = window.innerWidth / window.innerHeight;
        this.camera.aspect = aspect;
        this.camera.fov = aspect < 1 ? 85 : 75;
        this.camera.updateProjectionMatrix();

        if (aspect < 0.8) {
            this.camera.position.set(0, 6, 8);
            this.camera.lookAt(0, 0, -3);
        } else {
            this.camera.position.set(0, 4, 6);
            this.camera.lookAt(0, 0, -5);
        }

        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.isMobile ? 1.5 : 2));
    }

    // UI Facades
    showScreen(id) { this.ui.showScreen(id); }
    updateScore() { this.ui.updateScore(this.score, this.bestScore, this.comboCount); }
    showError(t, m) { this.ui.showError(t, m); }

    // Settings Facade
    saveSettings() { StorageManager.saveSettings(this.settings); }
    applySettings() {
        this.audio.musicEnabled = this.settings.musicEnabled;
        const hints = document.getElementById("keyboard-hints");
        if (hints) hints.style.display = this.settings.keyboardHintsEnabled ? "flex" : "none";
    }

    // Difficulty selection
    changeDifficulty(dir) {
        const diffs = ["easy", "medium", "hard"];
        const curIdx = diffs.indexOf(this.selectedDifficulty);
        const newIdx = Math.max(0, Math.min(diffs.length - 1, curIdx + dir));
        if (newIdx !== curIdx) {
            const prev = this.selectedDifficulty;
            this.selectedDifficulty = diffs[newIdx];
            AnalyticsManager.trackDifficultyChange(prev, this.selectedDifficulty);
            this.ui.updateDifficultyDisplay();
        }
    }

    applyDifficultySettings() {
        const cfg = this.difficultyConfig[this.selectedDifficulty];
        this.baseSpeed = cfg.baseSpeed;
        this.speedIncrement = cfg.speedIncrement;
        this.speed = this.baseSpeed;
    }

    getRandomObstacleInterval() {
        const r = this.difficultyConfig[this.selectedDifficulty].obstacleIntervalRange;
        return r[0] + Math.random() * (r[1] - r[0]);
    }

    getRandomCollectibleInterval() {
        const r = this.difficultyConfig[this.selectedDifficulty].collectibleIntervalRange;
        return r[0] + Math.random() * (r[1] - r[0]);
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
        } else {
            document.exitFullscreen().catch(() => {});
        }
    }

    checkWebGLSupport() {
        try {
            const c = document.createElement("canvas");
            return !!(window.WebGLRenderingContext && (c.getContext("webgl") || c.getContext("experimental-webgl")));
        } catch (e) {
            return false;
        }
    }

    setupPWA() {
        if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
            navigator.serviceWorker.register("assets/scripts/sw.js").catch(() => {});
        }
        window.addEventListener("appinstalled", () => {
            AnalyticsManager.trackPwaInstalled(this.isMobile ? "mobile" : "desktop");
        });
    }
}

// Start game when DOM is ready
if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
        window.addEventListener("DOMContentLoaded", () => {
            if (!window.game) new BunnyRunnerGame();
        });
    } else {
        if (!window.game) new BunnyRunnerGame();
    }
}
