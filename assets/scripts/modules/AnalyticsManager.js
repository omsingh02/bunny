// AnalyticsManager.js - tiny wrapper around Umami (the <script> tag in index.html).
// Fire-and-forget: if Umami is blocked or hasn't loaded, the event is just skipped.
export class AnalyticsManager {
    static runStartTime = 0;

    static track(name, data) {
        window.umami?.track(name, data);
    }

    static trackGameStart({ difficulty, platform, audioEnabled }) {
        this.runStartTime = Date.now();
        this.track('game-start', {
            difficulty,
            platform,
            audio_enabled: audioEnabled ? 'yes' : 'no'
        });
    }

    static trackGameOver({ difficulty, score, gems, cause, maxCombo, isNewBest }) {
        const seconds = this.runStartTime ? Math.max(1, Math.round((Date.now() - this.runStartTime) / 1000)) : 0;
        this.runStartTime = 0;
        this.track('game-over', {
            difficulty,
            score: Math.round(score),
            duration_sec: seconds,
            cause: String(cause),
            gems: Math.round(gems),
            max_combo: Math.round(maxCombo),
            is_new_best: isNewBest ? 'yes' : 'no'
        });
    }

    static trackHighScore(score, difficulty) {
        this.track('high-score-new', { score: Math.round(score), difficulty });
    }

    static trackDifficultyChange(from, to) {
        this.track('difficulty-change', { from_difficulty: from, to_difficulty: to });
    }

    static trackPwaInstalled(platform) {
        this.track('pwa-installed', { platform });
    }
}
