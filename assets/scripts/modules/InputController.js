// InputController.js - Unified Keyboard, Touch & Haptic Input Subsystem
export class InputController {
    constructor(game) {
        this.game = game;
        this.keys = {};
        this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    }

    init() {
        this.setupKeyboard();
        this.setupTouchControls();
    }

    triggerHapticFeedback(intensity = 'light') {
        if (!this.game.settings?.hapticEnabled || !navigator.vibrate) return;
        switch (intensity) {
            case 'light': navigator.vibrate(15); break;
            case 'medium': navigator.vibrate(30); break;
            case 'heavy': navigator.vibrate([50, 50, 50]); break;
            case 'success': navigator.vibrate([20, 30, 20]); break;
            default: navigator.vibrate(20);
        }
    }

    setupKeyboard() {
        document.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;

            if (this.game.gameState === 'playing') {
                if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
                    this.game.moveLane(-1);
                }
                if (e.code === 'ArrowRight' || e.code === 'KeyD') {
                    this.game.moveLane(1);
                }
                if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
                    e.preventDefault();
                    this.game.jump();
                }
                if (e.code === 'Escape') {
                    this.game.pauseGame();
                }
            }
        });

        document.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });
    }

    setupTouchControls() {
        if (!this.isTouchDevice) return;

        const touchLeft = document.getElementById('touch-left');
        const touchRight = document.getElementById('touch-right');
        const touchJump = document.getElementById('touch-jump');

        if (touchLeft && touchRight && touchJump) {
            [touchLeft, touchRight, touchJump].forEach(btn => {
                btn.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    btn.style.transform = 'scale(0.9)';
                });
                btn.addEventListener('touchend', (e) => {
                    e.preventDefault();
                    btn.style.transform = '';
                });
            });

            touchLeft.addEventListener('touchstart', (e) => {
                e.preventDefault();
                if (this.game.gameState === 'playing') {
                    this.triggerHapticFeedback('light');
                    this.game.moveLane(-1);
                }
            });

            touchRight.addEventListener('touchstart', (e) => {
                e.preventDefault();
                if (this.game.gameState === 'playing') {
                    this.triggerHapticFeedback('light');
                    this.game.moveLane(1);
                }
            });

            touchJump.addEventListener('touchstart', (e) => {
                e.preventDefault();
                if (this.game.gameState === 'playing') {
                    this.triggerHapticFeedback('medium');
                    this.game.jump();
                }
            });
        }

        this.setupSwipeGestures();
    }

    setupSwipeGestures() {
        let touchStartX = 0;
        let touchStartY = 0;
        let touchStartTime = 0;
        let isSwiping = false;
        let touchIdentifier = null;

        const minSwipeDistance = 50;
        const maxTapDuration = 150;

        document.addEventListener('touchstart', (e) => {
            if (this.game.gameState !== 'playing') return;

            const touch = e.touches[0];
            const element = document.elementFromPoint(touch.clientX, touch.clientY);
            if (element && (element.closest('.touch-controls') || element.closest('.hud-top'))) {
                return;
            }

            touchStartX = touch.clientX;
            touchStartY = touch.clientY;
            touchStartTime = Date.now();
            touchIdentifier = touch.identifier;
            isSwiping = false;
        }, { passive: false });

        document.addEventListener('touchmove', (e) => {
            if (this.game.gameState !== 'playing' || touchIdentifier === null) return;

            const touch = Array.from(e.touches).find(t => t.identifier === touchIdentifier);
            if (!touch) return;

            const deltaX = Math.abs(touch.clientX - touchStartX);
            const deltaY = Math.abs(touch.clientY - touchStartY);

            if (deltaX > 10 || deltaY > 10) {
                isSwiping = true;
                e.preventDefault();
            }
        }, { passive: false });

        document.addEventListener('touchend', (e) => {
            if (this.game.gameState !== 'playing' || touchIdentifier === null) return;

            const touch = Array.from(e.changedTouches).find(t => t.identifier === touchIdentifier);
            if (!touch) return;

            const touchEndX = touch.clientX;
            const touchEndY = touch.clientY;
            const touchDuration = Date.now() - touchStartTime;

            const deltaX = touchEndX - touchStartX;
            const deltaY = touchEndY - touchStartY;
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

            touchIdentifier = null;

            if (isSwiping) {
                this.handleSwipe(touchStartX, touchStartY, touchEndX, touchEndY, minSwipeDistance);
            } else if (touchDuration < maxTapDuration && distance < 20) {
                this.game.jump();
                this.triggerHapticFeedback('light');
            }
        });
    }

    handleSwipe(startX, startY, endX, endY, minDistance) {
        const deltaX = endX - startX;
        const deltaY = endY - startY;
        const absDeltaX = Math.abs(deltaX);
        const absDeltaY = Math.abs(deltaY);

        if (absDeltaX > minDistance || absDeltaY > minDistance) {
            if (absDeltaX > absDeltaY) {
                if (deltaX > 0) {
                    this.game.moveLane(1);
                    this.triggerHapticFeedback('light');
                } else {
                    this.game.moveLane(-1);
                    this.triggerHapticFeedback('light');
                }
            } else if (deltaY < -minDistance) {
                this.game.jump();
                this.triggerHapticFeedback('medium');
            }
        }
    }
}
