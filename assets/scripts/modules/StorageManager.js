// StorageManager.js - everything the game keeps in localStorage.
// Whatever comes out of storage is untrusted (old versions, hand edits, other apps on the same origin),
// so each value goes through a small pure cleaner (exported for the tests) before the game sees it.
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

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

// Known settings only, and only real booleans; anything else falls back to the default
export function cleanSettings(saved) {
    const settings = { ...DEFAULT_SETTINGS };
    if (isObject(saved)) {
        for (const key of Object.keys(DEFAULT_SETTINGS)) {
            if (typeof saved[key] === 'boolean') settings[key] = saved[key];
        }
    }
    return settings;
}

// A whole number of points, never negative or infinite
export function cleanScore(saved) {
    const score = Math.floor(Number(saved));
    return Number.isFinite(score) && score > 0 ? score : 0;
}

// Keeps the well-formed entries only: { score, difficulty, date, timestamp }
export function cleanLeaderboard(saved) {
    if (!Array.isArray(saved)) return [];
    return saved
        .filter(e => isObject(e) && DIFFICULTIES.includes(e.difficulty) && Number.isFinite(e.score) && e.score >= 0)
        .map(e => ({
            score: Math.floor(e.score),
            difficulty: e.difficulty,
            date: typeof e.date === 'string' ? e.date : '',
            timestamp: Number.isFinite(e.timestamp) ? e.timestamp : 0
        }));
}

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
        return cleanSettings(read(KEYS.settings, {}));
    }

    static saveSettings(settings) {
        write(KEYS.settings, settings);
    }

    static getBestScore() {
        return cleanScore(read(KEYS.best, 0));
    }

    static saveBestScore(score) {
        write(KEYS.best, score);
    }

    static loadLeaderboard() {
        return cleanLeaderboard(read(KEYS.leaderboard, []));
    }

    // Keeps the top scores of EACH difficulty (so the Easy tab never loses runs to Hard ones).
    // The list stays sorted best-first, so "All" is just its first few entries.
    static addToLeaderboard(leaderboard, score, difficulty) {
        const all = [...cleanLeaderboard(leaderboard), { score, difficulty, date: new Date().toLocaleDateString(), timestamp: Date.now() }];
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
            achievements[key].unlocked = isObject(saved) && saved[key]?.unlocked === true;
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
