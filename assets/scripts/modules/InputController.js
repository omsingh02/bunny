// InputController.js - keyboard, touch buttons, swipes and vibration
import { $ } from './dom.js';

const HAPTICS = { light: 15, medium: 30, heavy: [50, 50, 50], success: [20, 30, 20] };

export class InputController {
    constructor(game) {
        this.game = game;
    }

    init() {
        this.setupKeyboard();
        if (this.game.isTouchDevice) this.setupTouchControls();
    }

    triggerHapticFeedback(intensity = 'light') {
        if (!this.game.settings.hapticEnabled || !navigator.vibrate) return;
        navigator.vibrate(HAPTICS[intensity] ?? 20);
    }

    setupKeyboard() {
        document.addEventListener('keydown', (e) => {
            if (this.game.gameState !== 'playing') return;

            switch (e.code) {
                case 'ArrowLeft':
                case 'KeyA':
                    this.game.moveLane(-1);
                    break;
                case 'ArrowRight':
                case 'KeyD':
                    this.game.moveLane(1);
                    break;
                case 'Space':
                case 'ArrowUp':
                case 'KeyW':
                    e.preventDefault();
                    this.game.jump();
                    break;
                case 'Escape':
                    this.game.pauseGame();
                    break;
            }
        });
    }

    setupTouchControls() {
        const game = this.game;
        const buttons = {
            'touch-left': ['light', () => game.moveLane(-1)],
            'touch-right': ['light', () => game.moveLane(1)],
            'touch-jump': ['medium', () => game.jump()]
        };

        for (const [id, [haptic, action]] of Object.entries(buttons)) {
            const button = $(id);
            button.addEventListener('touchstart', (e) => {
                e.preventDefault();
                button.style.transform = 'scale(0.9)';
                if (game.gameState === 'playing') {
                    this.triggerHapticFeedback(haptic);
                    action();
                }
            });
            button.addEventListener('touchend', (e) => {
                e.preventDefault();
                button.style.transform = '';
            });
            button.addEventListener('touchcancel', () => {
                button.style.transform = '';
            });
        }

        this.setupSwipeGestures();
    }

    // Swipe left/right = change lane, swipe up = jump, quick tap anywhere = jump
    setupSwipeGestures() {
        let touch = null; // the finger we're tracking: { id, x, y, time, swiping }
        const playing = () => this.game.gameState === 'playing';
        const tracked = (list) => touch && Array.from(list).find(t => t.identifier === touch.id);

        document.addEventListener('touchstart', (e) => {
            if (!playing()) return;
            const t = e.changedTouches[0];
            // the on-screen buttons and the top bar handle their own touches
            if (document.elementFromPoint(t.clientX, t.clientY)?.closest('.touch-controls, .hud-top')) return;
            touch = { id: t.identifier, x: t.clientX, y: t.clientY, time: Date.now(), swiping: false };
        });

        document.addEventListener('touchmove', (e) => {
            const t = playing() && tracked(e.touches);
            if (!t) return;
            if (Math.abs(t.clientX - touch.x) > 10 || Math.abs(t.clientY - touch.y) > 10) {
                touch.swiping = true;
                e.preventDefault(); // stop the page from scrolling under the swipe
            }
        }, { passive: false });

        document.addEventListener('touchend', (e) => {
            const t = playing() && tracked(e.changedTouches);
            if (!t) return;

            const dx = t.clientX - touch.x;
            const dy = t.clientY - touch.y;
            const { swiping, time } = touch;
            touch = null;

            if (swiping) {
                this.handleSwipe(dx, dy);
            } else if (Date.now() - time < 150 && Math.hypot(dx, dy) < 20) {
                this.game.jump();
                this.triggerHapticFeedback('light');
            }
        });
    }

    handleSwipe(dx, dy) {
        const minDistance = 50;
        if (Math.abs(dx) > Math.abs(dy)) {
            if (Math.abs(dx) < minDistance) return;
            this.game.moveLane(dx > 0 ? 1 : -1);
            this.triggerHapticFeedback('light');
        } else if (dy < -minDistance) {
            this.game.jump();
            this.triggerHapticFeedback('medium');
        }
    }
}
