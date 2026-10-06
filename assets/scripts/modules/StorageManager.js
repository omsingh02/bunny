// StorageManager.js - everything the game keeps in localStorage
const KEYS = {
    settings: 'bunnyRunnerSettings',
    best: 'bunnyRunnerBestScore',
    leaderboard: 'bunnyRunnerLeaderboard',
    achievements: 'bunnyRunnerAchievements'
};

const DEFAULT_SETTINGS = {
    musicEnabled: true,
    sfxEnabled: true,
    hapticEnabled: true,
    particlesEnabled: true,
    keyboardHintsEnabled: true
};

const DIFFICULTIES = ['easy', 'medium', 'hard'];
const BOARD_SIZE = 10;

function read(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw === null ? fallback : JSON.parse(raw);
    } catch {
        return fallback;
    }
}

function write(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {}
}

export class StorageManager {
    // Saved settings are merged over the defaults, so newly added settings just work
    static loadSettings() {
        return { ...DEFAULT_SETTINGS, ...read(KEYS.settings, {}) };
    }

    static saveSettings(settings) {
        write(KEYS.settings, settings);
    }

    static getBestScore() {
        return Number(read(KEYS.best, 0)) || 0;
    }

    static saveBestScore(score) {
        write(KEYS.best, score);
    }

    static loadLeaderboard() {
        const saved = read(KEYS.leaderboard, []);
        return Array.isArray(saved) ? saved : [];
    }

    // Keeps the top scores of EACH difficulty (so the Easy tab never loses runs to Hard ones).
    // The list stays sorted best-first, so "All" is just its first few entries.
    static addToLeaderboard(leaderboard, score, difficulty) {
        const all = [...leaderboard, { score, difficulty, date: new Date().toLocaleDateString(), timestamp: Date.now() }];
        const kept = DIFFICULTIES
            .flatMap(d => all.filter(e => e.difficulty === d).sort((a, b) => b.score - a.score).slice(0, BOARD_SIZE))
            .sort((a, b) => b.score - a.score);
        write(KEYS.leaderboard, kept);
        return kept;
    }

    // Copies the saved "unlocked" flags onto the achievement definitions
    static loadAchievements(achievements) {
        const saved = read(KEYS.achievements, {});
        for (const key of Object.keys(achievements)) {
            achievements[key].unlocked = Boolean(saved[key]?.unlocked);
        }
        return achievements;
    }

    static saveAchievements(achievements) {
        const flags = Object.fromEntries(Object.entries(achievements).map(([key, a]) => [key, { unlocked: a.unlocked }]));
        write(KEYS.achievements, flags);
    }

    static clearAll() {
        Object.values(KEYS).forEach(key => {
            try { localStorage.removeItem(key); } catch {}
        });
    }
}
