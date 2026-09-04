// StorageManager.js - LocalStorage Persistence Subsystem (Settings, High Scores, Leaderboard, Achievements)
export class StorageManager {
    static loadSettings() {
        try {
            const saved = localStorage.getItem('bunnyRunnerSettings');
            return saved ? JSON.parse(saved) : {
                musicEnabled: true,
                sfxEnabled: true,
                hapticEnabled: true,
                shadowsEnabled: true,
                particlesEnabled: true,
                keyboardHintsEnabled: true
            };
        } catch (e) {
            return {
                musicEnabled: true,
                sfxEnabled: true,
                hapticEnabled: true,
                shadowsEnabled: true,
                particlesEnabled: true,
                keyboardHintsEnabled: true
            };
        }
    }

    static saveSettings(settings) {
        try {
            localStorage.setItem('bunnyRunnerSettings', JSON.stringify(settings));
        } catch (e) {}
    }

    static getBestScore() {
        try {
            return parseInt(localStorage.getItem('bunnyRunnerBestScore') || '0', 10);
        } catch (e) {
            return 0;
        }
    }

    static saveBestScore(score) {
        try {
            localStorage.setItem('bunnyRunnerBestScore', score.toString());
        } catch (e) {}
    }

    static loadLeaderboard() {
        try {
            const saved = localStorage.getItem('bunnyRunnerLeaderboard');
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            return [];
        }
    }

    static saveLeaderboard(leaderboard) {
        try {
            localStorage.setItem('bunnyRunnerLeaderboard', JSON.stringify(leaderboard));
        } catch (e) {}
    }

    static addToLeaderboard(leaderboard, score, difficulty) {
        const entry = {
            score,
            difficulty,
            date: new Date().toLocaleDateString(),
            timestamp: Date.now()
        };
        leaderboard.push(entry);
        leaderboard.sort((a, b) => b.score - a.score);
        const trimmed = leaderboard.slice(0, 10);
        StorageManager.saveLeaderboard(trimmed);
        return trimmed;
    }

    static loadAchievements(defaultAchievements) {
        try {
            const saved = localStorage.getItem('bunnyRunnerAchievements');
            if (saved) {
                const savedAchievements = JSON.parse(saved);
                Object.keys(savedAchievements).forEach(key => {
                    if (defaultAchievements[key]) {
                        defaultAchievements[key].unlocked = savedAchievements[key].unlocked;
                    }
                });
            }
        } catch (e) {}
        return defaultAchievements;
    }

    static saveAchievements(achievements) {
        try {
            localStorage.setItem('bunnyRunnerAchievements', JSON.stringify(achievements));
        } catch (e) {}
    }
}
