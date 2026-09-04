// UIController.js - DOM Screens, Transitions, Dialogs & HUD Subsystem
export class UIController {
    constructor(game) {
        this.game = game;
    }

    init() {
        this.setupButtons();
        this.setupDifficultySelector();
        this.setupSettingsScreen();
        this.setupLeaderboardScreen();
        this.setupTutorialScreen();
        this.setupErrorHandling();
    }

    showScreen(screenId) {
        document.querySelectorAll(".screen").forEach(screen => {
            screen.classList.add("hidden");
        });

        const target = document.getElementById(screenId);
        if (target) {
            target.classList.remove("hidden");
        }

        const touchControls = document.getElementById("touch-controls");
        if (touchControls) {
            if (this.game.isTouchDevice && screenId === "game-hud") {
                touchControls.classList.remove("hidden");
            } else {
                touchControls.classList.add("hidden");
            }
        }
    }

    updateScore(score, bestScore, comboCount = 0) {
        const cur = document.getElementById("current-score");
        if (cur) cur.textContent = score;

        const best = document.getElementById("best-score");
        if (best) best.textContent = bestScore;

        const comboDisplay = document.getElementById("combo-display");
        const comboCountEl = document.getElementById("combo-count");

        if (comboDisplay && comboCountEl) {
            if (comboCount > 1) {
                comboDisplay.style.display = "block";
                comboCountEl.textContent = comboCount + "x";
                comboDisplay.style.animation = "none";
                setTimeout(() => {
                    comboDisplay.style.animation = "comboPulse 0.3s ease-out";
                }, 10);
            } else {
                comboDisplay.style.display = "none";
            }
        }
    }

    updateMilestoneProgress(score, lastMilestone, nextMilestone) {
        const progress = Math.min(100, Math.max(0, ((score - lastMilestone) / (nextMilestone - lastMilestone)) * 100));
        const fill = document.getElementById("milestone-fill");
        const nextEl = document.getElementById("next-milestone");

        if (fill) fill.style.width = progress + "%";
        if (nextEl) nextEl.textContent = nextMilestone;
    }

    showComboFeedback(combo, score) {
        const feedback = document.createElement("div");
        feedback.className = "combo-feedback";
        feedback.innerHTML = "+" + score + " " + combo + "x COMBO! ✨";
        feedback.style.left = "50%";
        feedback.style.top = "40%";
        document.getElementById("game-container")?.appendChild(feedback);
        setTimeout(() => feedback.remove(), 1000);
    }

    showSpeedUpFeedback() {
        const speedText = document.createElement("div");
        speedText.className = "speed-indicator";
        speedText.textContent = "SPEED UP! ⚡";
        speedText.style.position = "absolute";
        speedText.style.top = "30%";
        speedText.style.left = "50%";
        speedText.style.transform = "translate(-50%, -50%)";
        speedText.style.color = "#FFD700";
        speedText.style.fontSize = "2rem";
        speedText.style.fontWeight = "bold";
        speedText.style.textShadow = "0 0 10px rgba(255, 215, 0, 0.5)";
        speedText.style.zIndex = "1000";
        speedText.style.animation = "speedPulse 0.5s ease-out";

        document.getElementById("game-container")?.appendChild(speedText);
        setTimeout(() => speedText.remove(), 500);
    }

    showAchievementToast(title, desc) {
        const toast = document.getElementById("achievement-toast");
        const titleEl = document.getElementById("achievement-title");
        const descEl = document.getElementById("achievement-desc");

        if (toast && titleEl && descEl) {
            titleEl.textContent = title;
            descEl.textContent = desc;
            toast.classList.add("show");
            setTimeout(() => { toast.classList.remove("show"); }, 3000);
        }
    }

    updatePauseMenuStats(score, bestScore, speed) {
        const pScore = document.getElementById("pause-current-score");
        const pBest = document.getElementById("pause-best-score");
        const pSpeed = document.getElementById("pause-speed");

        if (pScore) pScore.textContent = score;
        if (pBest) pBest.textContent = bestScore;
        if (pSpeed) pSpeed.textContent = speed.toFixed(1) + "x";
    }

    startCountdown() {
        return new Promise((resolve) => {
            const countdownScreen = document.getElementById("countdown-screen");
            const countdownNumber = document.getElementById("countdown-number");

            if (!countdownScreen || !countdownNumber) {
                resolve();
                return;
            }

            countdownScreen.classList.remove("hidden");

            const touchControls = document.getElementById("touch-controls");
            if (touchControls) touchControls.classList.add("hidden");

            let count = 3;
            const interval = setInterval(() => {
                countdownNumber.textContent = count;

                if (this.game.settings?.sfxEnabled) {
                    this.game.audio?.playCountdownSound();
                }
                if (this.game.settings?.hapticEnabled) {
                    this.game.input?.triggerHapticFeedback("light");
                }

                count--;

                if (count < 0) {
                    clearInterval(interval);
                    countdownNumber.textContent = "GO!";

                    if (this.game.settings?.sfxEnabled) {
                        this.game.audio?.soundEffects?.milestone?.();
                    }
                    if (this.game.settings?.hapticEnabled) {
                        this.game.input?.triggerHapticFeedback("medium");
                    }

                    setTimeout(() => {
                        countdownScreen.classList.add("hidden");
                        if (touchControls && this.game.isTouchDevice) {
                            touchControls.classList.remove("hidden");
                        }
                        resolve();
                    }, 500);
                }
            }, 1000);
        });
    }

    setupButtons() {
        const startBtn = document.getElementById("start-btn");
        if (startBtn) startBtn.addEventListener("click", () => {
            this.game.enableAudio();
            this.game.startGame();
        });

        const pauseBtn = document.getElementById("pause-btn");
        if (pauseBtn) pauseBtn.addEventListener("click", () => this.game.pauseGame());

        const resumeBtn = document.getElementById("resume-btn");
        if (resumeBtn) resumeBtn.addEventListener("click", () => this.game.resumeGame());

        const restartBtn = document.getElementById("restart-btn");
        if (restartBtn) restartBtn.addEventListener("click", () => this.game.restartGame());

        const menuBtn = document.getElementById("menu-btn");
        if (menuBtn) menuBtn.addEventListener("click", () => this.game.showMainMenu());

        const playAgainBtn = document.getElementById("play-again-btn");
        if (playAgainBtn) playAgainBtn.addEventListener("click", () => this.game.restartGame());

        const menuReturnBtn = document.getElementById("menu-return-btn");
        if (menuReturnBtn) menuReturnBtn.addEventListener("click", () => this.game.showMainMenu());

        const musicToggle = document.getElementById("music-toggle");
        if (musicToggle) musicToggle.addEventListener("click", () => this.game.toggleMusic());

        const fullscreenToggle = document.getElementById("fullscreen-toggle");
        if (fullscreenToggle) {
            if (this.game.isMobile) fullscreenToggle.style.display = "block";
            fullscreenToggle.addEventListener("click", () => this.game.toggleFullscreen());
        }
    }

    setupDifficultySelector() {
        const prevBtn = document.getElementById("diff-prev-btn");
        const nextBtn = document.getElementById("diff-next-btn");

        if (prevBtn) prevBtn.addEventListener("click", () => this.game.changeDifficulty(-1));
        if (nextBtn) nextBtn.addEventListener("click", () => this.game.changeDifficulty(1));

        this.updateDifficultyDisplay();
    }

    updateDifficultyDisplay() {
        const config = this.game.difficultyConfig[this.game.selectedDifficulty];
        const nameEl = document.getElementById("difficulty-name");
        const descEl = document.getElementById("difficulty-desc");

        if (nameEl) nameEl.textContent = config.icon + " " + config.name;
        if (descEl) descEl.textContent = config.description;

        const badge = document.querySelector(".difficulty-badge");
        if (badge) {
            badge.textContent = config.badge;
            badge.className = "difficulty-badge " + config.badgeClass + " show";
        }
    }

    setupSettingsScreen() {
        if (this.game.isMobile) {
            const fullscreenSettingItem = document.getElementById("fullscreen-setting-item");
            if (fullscreenSettingItem) fullscreenSettingItem.style.display = "block";

            const fullscreenSettingBtn = document.getElementById("fullscreen-setting-btn");
            if (fullscreenSettingBtn) {
                fullscreenSettingBtn.addEventListener("click", () => this.game.toggleFullscreen());
            }
        }

        const settingsBtn = document.getElementById("settings-btn");
        if (settingsBtn) settingsBtn.addEventListener("click", () => this.showScreen("settings-screen"));

        const settingsCloseBtn = document.getElementById("settings-close-btn");
        if (settingsCloseBtn) settingsCloseBtn.addEventListener("click", () => this.showScreen("main-menu"));

        const pauseSettingsBtn = document.getElementById("pause-settings-btn");
        if (pauseSettingsBtn) pauseSettingsBtn.addEventListener("click", () => this.showScreen("settings-screen"));

        const musicToggle = document.getElementById("music-setting");
        if (musicToggle) {
            musicToggle.addEventListener("change", (e) => {
                this.game.settings.musicEnabled = e.target.checked;
                this.game.audio.musicEnabled = e.target.checked;
                this.game.saveSettings();
                if (!e.target.checked) this.game.audio.stopBackgroundMusic();
            });
        }

        const sfxToggle = document.getElementById("sfx-setting");
        if (sfxToggle) {
            sfxToggle.addEventListener("change", (e) => {
                this.game.settings.sfxEnabled = e.target.checked;
                this.game.saveSettings();
            });
        }

        const hapticToggle = document.getElementById("haptic-setting");
        if (hapticToggle) {
            hapticToggle.addEventListener("change", (e) => {
                this.game.settings.hapticEnabled = e.target.checked;
                this.game.saveSettings();
            });
        }

        const particlesToggle = document.getElementById("particles-setting");
        if (particlesToggle) {
            particlesToggle.addEventListener("change", (e) => {
                this.game.settings.particlesEnabled = e.target.checked;
                this.game.saveSettings();
            });
        }

        const keyboardHintsToggle = document.getElementById("keyboard-hints-setting");
        if (keyboardHintsToggle) {
            keyboardHintsToggle.addEventListener("change", (e) => {
                this.game.settings.keyboardHintsEnabled = e.target.checked;
                this.game.saveSettings();
                const hints = document.getElementById("keyboard-hints");
                if (hints) hints.style.display = e.target.checked ? "flex" : "none";
            });
        }

        const resetDataBtn = document.getElementById("reset-data-btn");
        if (resetDataBtn) {
            resetDataBtn.addEventListener("click", () => {
                if (confirm("Are you sure you want to reset all game data? This cannot be undone!")) {
                    localStorage.removeItem("bunnyRunnerBestScore");
                    localStorage.removeItem("bunnyRunnerLeaderboard");
                    localStorage.removeItem("bunnyRunnerAchievements");
                    localStorage.removeItem("bunnyRunnerSettings");
                    alert("Data reset successfully! The game will now reload.");
                    window.location.reload();
                }
            });
        }
    }

    setupLeaderboardScreen() {
        let currentFilter = "all";

        const renderLeaderboard = (filter) => {
            const list = document.getElementById("leaderboard-list");
            if (!list) return;

            let filtered = this.game.leaderboard;
            if (filter !== "all") {
                const diffIndex = parseInt(filter);
                const diffNames = ["easy", "medium", "hard"];
                filtered = this.game.leaderboard.filter(e => e.difficulty === diffNames[diffIndex]);
            }

            if (filtered.length === 0) {
                list.innerHTML = "<div class=\"leaderboard-empty\"><p>🌟 No scores yet!</p><p>Start playing to see your scores here!</p></div>";
                return;
            }

            const icons = { easy: "🌸", medium: "💕", hard: "⚡" };
            list.innerHTML = filtered.map((e, idx) => {
                const rankClass = idx === 0 ? "gold" : idx === 1 ? "silver" : idx === 2 ? "bronze" : "";
                return "<div class=\"leaderboard-entry\">" +
                    "<div class=\"leaderboard-rank " + rankClass + "\">#" + (idx + 1) + "</div>" +
                    "<div class=\"leaderboard-info\">" +
                        "<div class=\"leaderboard-score\">" + e.score + " points</div>" +
                        "<div class=\"leaderboard-meta\">" + (icons[e.difficulty] || "💕") + " " + e.difficulty + " • " + e.date + "</div>" +
                    "</div>" +
                "</div>";
            }).join("");
        };

        document.querySelectorAll(".leaderboard-tab").forEach(tab => {
            tab.addEventListener("click", () => {
                document.querySelectorAll(".leaderboard-tab").forEach(t => t.classList.remove("active"));
                tab.classList.add("active");
                currentFilter = tab.dataset.difficulty;
                renderLeaderboard(currentFilter);
            });
        });

        const lbBtn = document.getElementById("leaderboard-btn");
        if (lbBtn) lbBtn.addEventListener("click", () => {
            this.showScreen("leaderboard-screen");
            renderLeaderboard(currentFilter);
        });

        const lbClose = document.getElementById("leaderboard-close-btn");
        if (lbClose) lbClose.addEventListener("click", () => this.showScreen("main-menu"));
    }

    setupTutorialScreen() {
        const howToPlayBtn = document.getElementById("how-to-play-btn");
        if (howToPlayBtn) howToPlayBtn.addEventListener("click", () => this.showScreen("tutorial-screen"));

        const tutorialCloseBtn = document.getElementById("tutorial-close-btn");
        if (tutorialCloseBtn) tutorialCloseBtn.addEventListener("click", () => this.showScreen("main-menu"));
    }

    setupErrorHandling() {
        const retryBtn = document.getElementById("error-retry-btn");
        if (retryBtn) retryBtn.addEventListener("click", () => window.location.reload());

        const supportBtn = document.getElementById("error-support-btn");
        if (supportBtn) supportBtn.addEventListener("click", () => {
            window.open("https://github.com/omsingh02/bunny/issues", "_blank");
        });
    }

    showError(title, message) {
        const screen = document.getElementById("error-screen");
        const titleEl = document.getElementById("error-title");
        const descEl = document.getElementById("error-description");

        if (screen) {
            if (titleEl) titleEl.textContent = title;
            if (descEl) descEl.textContent = message;
            screen.classList.remove("hidden");
        }
    }
}
