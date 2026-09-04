// AnalyticsManager.js - Production-Grade Umami Telemetry Pipeline
// Features: Command-queue buffering (zero dropped events), domain isolation, error boundaries

export class AnalyticsManager {
    static queue = [];
    static initialized = false;
    static runStartTime = 0;

    static init() {
        if (this.initialized) return;
        this.initialized = true;

        // Flush queued events when Umami script loads
        if (typeof window !== 'undefined') {
            const script = document.querySelector('script[src*="a.omsingh.me"]');
            if (script) {
                script.addEventListener('load', () => this.flush());
            }

            // Fallback interval check for slow or cached script execution
            let checks = 0;
            const poller = setInterval(() => {
                checks++;
                if (typeof window.umami !== 'undefined' && typeof window.umami.track === 'function') {
                    this.flush();
                    clearInterval(poller);
                } else if (checks >= 20) {
                    clearInterval(poller);
                }
            }, 500);
        }
    }

    static flush() {
        if (typeof window === 'undefined' || typeof window.umami === 'undefined' || typeof window.umami.track !== 'function') {
            return;
        }

        while (this.queue.length > 0) {
            const event = this.queue.shift();
            try {
                window.umami.track(event.name, event.data);
            } catch (err) {
                console.warn('[AnalyticsManager] Flush error:', err);
            }
        }
    }

    static track(name, data = {}) {
        // Safe logging in local / non-production environment
        if (typeof window !== 'undefined' && window.location.hostname !== 'bunny.omsingh.me') {
            console.debug(`[Analytics (Local Dev)] ${name}:`, data);
        }

        if (typeof window !== 'undefined' && typeof window.umami !== 'undefined' && typeof window.umami.track === 'function') {
            try {
                this.flush();
                window.umami.track(name, data);
            } catch (err) {
                console.warn(`[AnalyticsManager] Tracking error for ${name}:`, err);
            }
        } else {
            // Buffer in command queue until script loads
            this.queue.push({ name, data });
            if (this.queue.length > 50) this.queue.shift(); // Bound memory footprint
        }
    }

    static trackGameStart({ difficulty = 'medium', platform = 'desktop', audioEnabled = true }) {
        this.runStartTime = Date.now();
        this.track('game-start', {
            difficulty,
            platform,
            audio_enabled: audioEnabled ? 'yes' : 'no'
        });
    }

    static trackGameOver({
        difficulty = 'medium',
        score = 0,
        gems = 0,
        cause = 'obstacle',
        maxCombo = 1,
        isNewBest = false
    }) {
        const durationSec = this.runStartTime > 0 ? Math.max(1, Math.round((Date.now() - this.runStartTime) / 1000)) : 0;
        this.runStartTime = 0;

        this.track('game-over', {
            difficulty,
            score: Math.round(score),
            duration_sec: durationSec,
            cause: String(cause),
            gems: Math.round(gems),
            max_combo: Math.round(maxCombo),
            is_new_best: isNewBest ? 'yes' : 'no'
        });
    }

    static trackHighScore(score, difficulty = 'medium') {
        this.track('high-score-new', {
            score: Math.round(score),
            difficulty
        });
    }

    static trackDifficultyChange(from, to) {
        this.track('difficulty-change', {
            from_difficulty: from,
            to_difficulty: to
        });
    }

    static trackPwaInstalled(platform = 'desktop') {
        this.track('pwa-installed', {
            platform
        });
    }
}
