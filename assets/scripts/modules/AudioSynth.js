// AudioSynth.js - Web Audio API Procedural Synthesizer & Sound FX Subsystem
export class AudioSynth {
    constructor(game) {
        this.game = game;
        this.audioListener = null;
        this.audioEnabled = false;
        this.musicEnabled = true;
        this.activeOscillators = [];
        this.musicLoopInterval = null;
        this.musicToggleCooldown = false;
        this.soundEffects = {};
    }

    init(camera) {
        this.audioListener = new THREE.AudioListener();
        camera.add(this.audioListener);
        this.createSoundEffects();
    }

    enableAudio() {
        if (!this.audioEnabled) {
            this.audioEnabled = true;
            if (this.audioListener && this.audioListener.context.state === 'suspended') {
                this.audioListener.context.resume();
            }
        }
    }

    createSoundEffects() {
        this.soundEffects = {
            jump: () => this.playBoingSound(),
            collect: () => this.playChimeSound(),
            gameOver: () => this.playAwwSound(),
            milestone: () => this.playCelebrationSound()
        };
    }

    getContext() {
        return this.audioListener ? this.audioListener.context : null;
    }

    playBoingSound() {
        if (!this.audioEnabled || !this.game.settings?.sfxEnabled) return;
        const ctx = this.getContext();
        if (!ctx) return;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.1);
        osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.2);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2000, ctx.currentTime);

        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);

        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.2);
    }

    playChimeSound() {
        if (!this.audioEnabled || !this.game.settings?.sfxEnabled) return;
        const ctx = this.getContext();
        if (!ctx) return;

        const frequencies = [800, 1000, 1200, 1600];
        frequencies.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.type = 'sine';
            const startTime = ctx.currentTime + idx * 0.05;
            osc.frequency.setValueAtTime(freq, startTime);

            gain.gain.setValueAtTime(0, startTime);
            gain.gain.exponentialRampToValueAtTime(0.2, startTime + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3);

            osc.start(startTime);
            osc.stop(startTime + 0.3);
        });
    }

    playAwwSound() {
        if (!this.audioEnabled || !this.game.settings?.sfxEnabled) return;
        const ctx = this.getContext();
        if (!ctx) return;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(300, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(200, ctx.currentTime + 0.5);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, ctx.currentTime);

        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.5);
    }

    playCelebrationSound() {
        if (!this.audioEnabled || !this.game.settings?.sfxEnabled) return;
        const ctx = this.getContext();
        if (!ctx) return;

        const frequencies = [400, 500, 600, 800, 1000];
        frequencies.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.type = 'square';
            const startTime = ctx.currentTime + idx * 0.1;
            osc.frequency.setValueAtTime(freq, startTime);

            gain.gain.setValueAtTime(0.3, startTime);
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3);

            osc.start(startTime);
            osc.stop(startTime + 0.3);
        });
    }

    playCountdownSound() {
        if (!this.audioEnabled || !this.game.settings?.sfxEnabled) return;
        const ctx = this.getContext();
        if (!ctx) return;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.15);
    }

    startBackgroundMusic() {
        if (!this.audioEnabled || !this.musicEnabled) return;
        this.stopBackgroundMusic();
        this.playBackgroundMelody();

        this.musicLoopInterval = setInterval(() => {
            if (this.musicEnabled && this.audioEnabled) {
                this.playBackgroundMelody();
            }
        }, 8000);
    }

    playBackgroundMelody() {
        if (!this.audioEnabled || !this.musicEnabled) return;
        const ctx = this.getContext();
        if (!ctx) return;

        const melody = [
            { note: 523, time: 0.0, duration: 0.3 },
            { note: 587, time: 0.4, duration: 0.3 },
            { note: 659, time: 0.8, duration: 0.3 },
            { note: 523, time: 1.2, duration: 0.3 },
            { note: 659, time: 1.8, duration: 0.3 },
            { note: 698, time: 2.2, duration: 0.6 },
            { note: 659, time: 3.0, duration: 0.3 },
            { note: 587, time: 3.4, duration: 0.3 },
            { note: 523, time: 3.8, duration: 0.8 },
        ];

        melody.forEach(({ note, time, duration }) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.type = 'sine';
            osc.frequency.setValueAtTime(note, ctx.currentTime + time);

            const volume = this.game.gameState === 'gameOver' ? 0.1 : 0.2;
            gain.gain.setValueAtTime(0, ctx.currentTime + time);
            gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + time + 0.05);
            gain.gain.linearRampToValueAtTime(volume * 0.7, ctx.currentTime + time + duration * 0.7);
            gain.gain.linearRampToValueAtTime(0, ctx.currentTime + time + duration);

            const startTime = ctx.currentTime + time;
            const endTime = startTime + duration;

            osc.start(startTime);
            osc.stop(endTime);

            this.activeOscillators.push({ oscillator: osc, gainNode: gain, endTime });

            osc.onended = () => {
                this.activeOscillators = this.activeOscillators.filter(item => item.oscillator !== osc);
                try {
                    osc.disconnect();
                    gain.disconnect();
                } catch (e) {}
            };
        });
    }

    stopBackgroundMusic() {
        if (this.musicLoopInterval) {
            clearInterval(this.musicLoopInterval);
            this.musicLoopInterval = null;
        }

        if (this.activeOscillators && this.activeOscillators.length > 0) {
            const now = this.getContext()?.currentTime || 0;
            this.activeOscillators.forEach(({ oscillator, gainNode }) => {
                try {
                    gainNode.gain.cancelScheduledValues(now);
                    gainNode.gain.setValueAtTime(gainNode.gain.value, now);
                    gainNode.gain.linearRampToValueAtTime(0, now + 0.05);
                    oscillator.stop(now + 0.05);
                } catch (e) {}
            });
            this.activeOscillators = [];
        }
    }

    toggleMusic() {
        if (this.musicToggleCooldown) return;
        this.musicToggleCooldown = true;
        setTimeout(() => { this.musicToggleCooldown = false; }, 300);

        this.musicEnabled = !this.musicEnabled;
        if (this.game.settings) {
            this.game.settings.musicEnabled = this.musicEnabled;
            this.game.saveSettings();
        }

        const musicToggleSetting = document.getElementById('music-setting');
        if (musicToggleSetting) musicToggleSetting.checked = this.musicEnabled;

        const musicBtn = document.getElementById('music-toggle');
        if (musicBtn) {
            if (this.musicEnabled) {
                musicBtn.innerHTML = '<span style="font-size: 1.2rem; font-weight: bold;">♫</span>';
                musicBtn.title = 'Mute Music';
                if (this.audioEnabled && this.game.gameState === 'playing') {
                    this.startBackgroundMusic();
                }
            } else {
                musicBtn.innerHTML = '<span style="font-size: 1.2rem; font-weight: bold;">♪</span>';
                musicBtn.title = 'Unmute Music';
                this.stopBackgroundMusic();
            }
        }
    }
}
