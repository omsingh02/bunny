// UIController.js - screens, HUD and every button/toggle in the DOM
import { $ } from './dom.js';
import { StorageManager } from './StorageManager.js';

const on = (id, event, handler) => $(id).addEventListener(event, handler);
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// settings-screen checkbox id -> key in game.settings
export const SETTING_TOGGLES = {
    'music-setting': 'musicEnabled',
    'sfx-setting': 'sfxEnabled',
    'haptic-setting': 'hapticEnabled',
    'particles-setting': 'particlesEnabled',
    'keyboard-hints-setting': 'keyboardHintsEnabled'
};

const RANK_CLASSES = ['gold', 'silver', 'bronze'];

const GAME_OVER_MESSAGES = [
    'What a cute run, bestie! 💕',
    'Cutest run ever! 🐰',
    'Best BFF! 🌸',
    'So proud of you! 💖',
    'Keep hopping! ✨'
];

export class UIController {
    constructor(game) {
        this.game = game;
        this.shownCombo = 0;          // combo currently on screen (so the pulse only replays when it grows)
        this.toastTimer = null;
        this.settingsReturnTo = 'main-menu'; // where "SAVE & CLOSE" goes back to
    }

    init() {
        this.setupButtons();
        this.setupDifficultySelector();
        this.setupSettingsScreen();
        this.setupLeaderboardScreen();
    }

    // ---- screens -------------------------------------------------------------------------

    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => screen.classList.add('hidden'));
        $(screenId).classList.remove('hidden');
        $('touch-controls').classList.toggle('hidden', !(this.game.isTouchDevice && screenId === 'game-hud'));
        this.game.renderPending = true; // the 3D scene is only redrawn on idle screens when something changed
    }

    showMainMenu(bestScore) {
        $('best-score-menu').textContent = bestScore;
        this.showScreen('main-menu');
    }

    showGameOver(score, bestScore, isNewBest) {
        $('final-score').textContent = score;
        $('best-score-final').textContent = bestScore;
        $('game-over-title').textContent = isNewBest ? 'New Best Score! 🏆' : "You're Awesome!";
        $('game-over-message').textContent = isNewBest
            ? 'Amazing work, bestie! 💖'
            : GAME_OVER_MESSAGES[Math.floor(Math.random() * GAME_OVER_MESSAGES.length)];
        $('celebration').style.display = isNewBest ? 'block' : 'none'; // confetti only for a new best
        this.showScreen('game-over');
    }

    showError(title, message, error) {
        $('error-title').textContent = title;
        $('error-message').textContent = message;
        $('error-details').textContent = error?.stack || '';
        this.showScreen('error-screen');
    }

    // ---- HUD -----------------------------------------------------------------------------

    updateScore(score, bestScore, combo) {
        $('current-score').textContent = score;
        $('best-score').textContent = bestScore;

        const box = $('combo-display');
        if (combo > 1) {
            $('combo-count').textContent = combo + 'x';
            box.style.display = 'block';
            if (combo !== this.shownCombo) {
                box.style.animation = 'none';
                void box.offsetWidth;        // force a reflow so the stylesheet animation starts over
                box.style.animation = '';
            }
        } else {
            box.style.display = 'none';
        }
        this.shownCombo = combo;
    }

    updateMilestoneProgress(score, lastMilestone, nextMilestone) {
        const progress = ((score - lastMilestone) / (nextMilestone - lastMilestone)) * 100;
        $('milestone-fill').style.width = Math.min(100, Math.max(0, progress)) + '%';
        $('next-milestone').textContent = nextMilestone;
    }

    showComboFeedback(combo, points) {
        const feedback = document.createElement('div');
        feedback.className = 'combo-feedback';
        feedback.textContent = `+${points} ${combo}x COMBO! ✨`;
        $('game-container').appendChild(feedback);
        setTimeout(() => feedback.remove(), 1000);
    }

    showAchievementToast(title, desc) {
        $('achievement-title').textContent = title;
        $('achievement-desc').textContent = desc;
        const toast = $('achievement-toast');
        toast.classList.add('show');
        clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
    }

    updatePauseMenuStats(score, maxCombo) {
        $('pause-score').textContent = score;
        $('pause-combo').textContent = maxCombo + 'x';
    }

    // 3... 2... 1... GO! (resolves when the run should start)
    async startCountdown() {
        const countdown = $('countdown-screen');
        const number = $('countdown-number');
        const { audio, input } = this.game;

        countdown.classList.remove('hidden');
        $('touch-controls').classList.add('hidden');

        for (const label of ['3', '2', '1', 'GO!']) {
            const go = label === 'GO!';
            number.textContent = label;
            number.style.animation = 'none';
            void number.offsetWidth;         // replay the pop-in animation for every number
            number.style.animation = '';

            audio.play(go ? 'milestone' : 'countdown');
            input.triggerHapticFeedback(go ? 'medium' : 'light');
            await sleep(go ? 350 : 650);
        }

        countdown.classList.add('hidden');
        if (this.game.isTouchDevice) $('touch-controls').classList.remove('hidden');
    }

    // ---- buttons -------------------------------------------------------------------------

    setupButtons() {
        const game = this.game;

        on('start-btn', 'click', () => game.startGame());
        on('restart-btn', 'click', () => game.startGame());
        on('play-again-btn', 'click', () => game.startGame());
        on('pause-btn', 'click', () => game.pauseGame());
        on('resume-btn', 'click', () => game.resumeGame());
        on('menu-btn', 'click', () => game.showMainMenu());
        on('menu-return-btn', 'click', () => game.showMainMenu());
        on('music-toggle', 'click', () => game.setSetting('musicEnabled', !game.settings.musicEnabled));

        on('fullscreen-toggle', 'click', () => game.toggleFullscreen());
        on('fullscreen-setting-btn', 'click', () => game.toggleFullscreen());
        if (game.isMobile) {
            $('fullscreen-toggle').style.display = 'block';
            $('fullscreen-setting-item').style.display = 'block';
        }

        on('how-to-play-btn', 'click', () => this.showScreen('tutorial-screen'));
        on('tutorial-close-btn', 'click', () => this.showScreen('main-menu'));
        on('error-retry-btn', 'click', () => location.reload());
    }

    setupDifficultySelector() {
        on('difficulty-prev', 'click', () => this.game.changeDifficulty(-1));
        on('difficulty-next', 'click', () => this.game.changeDifficulty(1));
        this.updateDifficultyDisplay();
    }

    updateDifficultyDisplay() {
        const key = this.game.selectedDifficulty;
        const { icon, name, description } = this.game.difficultyConfig[key];
        $('current-difficulty-icon').textContent = icon;
        $('current-difficulty-name').textContent = name;
        $('current-difficulty-desc').textContent = description;
        $('recommended-badge').classList.toggle('show', key === 'medium');
    }

    // ---- settings ------------------------------------------------------------------------

    setupSettingsScreen() {
        const open = (from) => {
            this.settingsReturnTo = from;
            this.showScreen('settings-screen');
        };
        on('settings-btn', 'click', () => open('main-menu'));
        on('pause-settings-btn', 'click', () => open('pause-menu'));
        on('settings-close-btn', 'click', () => this.showScreen(this.settingsReturnTo));

        for (const [id, key] of Object.entries(SETTING_TOGGLES)) {
            on(id, 'change', (e) => this.game.setSetting(key, e.target.checked));
        }

        on('reset-data-btn', 'click', () => {
            if (confirm('Are you sure you want to reset all game data? This cannot be undone!')) {
                StorageManager.clearAll();
                location.reload();
            }
        });
    }

    // Makes the toggles, the music button and the keyboard hints match the saved settings
    syncSettings(settings) {
        for (const [id, key] of Object.entries(SETTING_TOGGLES)) {
            $(id).checked = settings[key];
        }
        $('keyboard-hints').style.display = settings.keyboardHintsEnabled ? 'flex' : 'none';

        const music = $('music-toggle');
        music.querySelector('span').textContent = settings.musicEnabled ? '♫' : '♪';
        music.title = settings.musicEnabled ? 'Mute Music' : 'Unmute Music';
    }

    // ---- leaderboard ---------------------------------------------------------------------

    setupLeaderboardScreen() {
        let filter = 'all'; // 'all' or a difficulty key

        const render = () => {
            const board = this.game.leaderboard;
            const entries = filter === 'all' ? board.slice(0, 10) : board.filter(e => e.difficulty === filter);

            $('leaderboard-list').innerHTML = entries.length
                ? entries.map((e, i) => `
                    <div class="leaderboard-entry">
                        <div class="leaderboard-rank ${RANK_CLASSES[i] ?? ''}">#${i + 1}</div>
                        <div class="leaderboard-info">
                            <div class="leaderboard-score">${Number(e.score)} points</div>
                            <div class="leaderboard-meta">${this.game.difficultyConfig[e.difficulty]?.icon ?? '💕'} ${e.difficulty} • ${e.date}</div>
                        </div>
                    </div>`).join('')
                : '<div class="leaderboard-empty"><p>🌟 No scores yet!</p><p>Start playing to see your scores here!</p></div>';
        };

        const tabs = document.querySelectorAll('.leaderboard-tab');
        tabs.forEach(tab => tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.toggle('active', t === tab));
            filter = tab.dataset.difficulty;
            render();
        }));

        on('leaderboard-btn', 'click', () => {
            this.showScreen('leaderboard-screen');
            render();
        });
        on('leaderboard-close-btn', 'click', () => this.showScreen('main-menu'));
    }
}
