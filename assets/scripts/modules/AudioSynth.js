// AudioSynth.js - every sound is a few oscillator notes made on the fly (no audio files)

// Sound effects: each one is a handful of notes. See note() for the options.
const SFX = {
    jump:      (a) => a.note(600, { dur: 0.2, vol: 0.3, glide: [[300, 0.1], [400, 0.2]], lowpass: 2000 }),
    collect:   (a) => [800, 1000, 1200, 1600].forEach((hz, i) => a.note(hz, { at: i * 0.05, dur: 0.3 })),
    gameOver:  (a) => a.note(300, { type: 'triangle', dur: 0.5, vol: 0.25, glide: [[200, 0.5]], lowpass: 800 }),
    milestone: (a) => [400, 500, 600, 800, 1000].forEach((hz, i) => a.note(hz, { at: i * 0.1, type: 'square', dur: 0.3, vol: 0.3 })),
    countdown: (a) => a.note(880, { dur: 0.15 })
};

// Background tune as [frequency, start time (s), duration (s)]. It lasts ~4.6s and loops every 8s.
const MELODY = [
    [523, 0.0, 0.3], [587, 0.4, 0.3], [659, 0.8, 0.3], [523, 1.2, 0.3], [659, 1.8, 0.3],
    [698, 2.2, 0.6], [659, 3.0, 0.3], [587, 3.4, 0.3], [523, 3.8, 0.8]
];

export class AudioSynth {
    constructor(game) {
        this.game = game;
        this.ctx = null;        // created on the first click (browsers block audio before a user gesture)
        this.musicBus = null;   // all music notes go through this so they can be faded out together
        this.musicLoop = null;
    }

    enableAudio() {
        try {
            if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            if (this.ctx.state === 'suspended') this.ctx.resume();
        } catch {
            this.ctx = null; // no Web Audio here: the game is just quiet
        }
    }

    play(name) {
        if (!this.ctx || !this.game.settings.sfxEnabled) return;
        SFX[name](this);
    }

    // One oscillator note.
    //   at: start offset in s   dur: length in s   vol: loudness   type: waveform
    //   glide: [[hz, time], ...] pitch slides   lowpass: filter cutoff in Hz
    //   soft: gentle music envelope instead of a quick sfx decay   out: node to play into
    note(freq, { at = 0, dur = 0.2, vol = 0.2, type = 'sine', glide = [], lowpass = 0, soft = false, out = null } = {}) {
        const ctx = this.ctx;
        const t = ctx.currentTime + at;
        const osc = ctx.createOscillator();
        const amp = ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, t);
        glide.forEach(([hz, when]) => osc.frequency.exponentialRampToValueAtTime(hz, t + when));

        if (soft) {
            amp.gain.setValueAtTime(0, t);
            amp.gain.linearRampToValueAtTime(vol, t + 0.05);
            amp.gain.linearRampToValueAtTime(vol * 0.7, t + dur * 0.7);
            amp.gain.linearRampToValueAtTime(0, t + dur);
        } else {
            amp.gain.setValueAtTime(vol, t);
            amp.gain.exponentialRampToValueAtTime(0.01, t + dur);
        }

        let source = osc;
        if (lowpass) {
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = lowpass;
            osc.connect(filter);
            source = filter;
        }
        source.connect(amp);
        amp.connect(out || ctx.destination);

        osc.start(t);
        osc.stop(t + dur);
    }

    startBackgroundMusic() {
        if (!this.ctx || !this.game.settings.musicEnabled) return;
        this.stopBackgroundMusic();
        this.musicBus = this.ctx.createGain();
        this.musicBus.connect(this.ctx.destination);
        this.playMelody();
        this.musicLoop = setInterval(() => this.playMelody(), 8000);
    }

    playMelody() {
        MELODY.forEach(([hz, at, dur]) => this.note(hz, { at, dur, soft: true, out: this.musicBus }));
    }

    stopBackgroundMusic() {
        clearInterval(this.musicLoop);
        this.musicLoop = null;
        if (!this.musicBus) return;

        const bus = this.musicBus;
        this.musicBus = null;
        bus.gain.setTargetAtTime(0, this.ctx.currentTime, 0.02); // quick fade, then unplug whatever is still scheduled
        setTimeout(() => bus.disconnect(), 300);
    }
}
