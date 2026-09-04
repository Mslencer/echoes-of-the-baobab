// ---------------------------------------------------------------------------
// Echoes of the Baobab — shared helpers (Web Audio procedural soundscape).
// Used by src/game/main.ts (Game scene) and src/App.tsx (menu ambience).
// ---------------------------------------------------------------------------

export type GamePhase =
    | "BOOT" | "MENU" | "PLAYING" | "PAUSED" | "MEMORIES" | "SETTINGS" | "FINISHED";

export interface EchoInfo {
    id: string;
    title: string;
    description: string;
    icon: string;
}

export const ECHOES: EchoInfo[] = [
    {
        id: "roots",
        title: "Song of the Roots",
        description: "In the Chime Grove of the North-West, the elders left five singing stones. Kaelo repeated the pentatonic prayer — Do, Re, Mi, Sol, La — and the roots of the Baobab hummed awake.",
        icon: "kalimba",
    },
    {
        id: "sunstone",
        title: "Sunstone Glyph Dial",
        description: "At the Sun Altar of the North-East, three stone rings carried the marks of Sun, Horn, Spiral and River. When the solar ray touched the heart crystal, the ancestors smiled at noon.",
        icon: "dial",
    },
    {
        id: "fireflies",
        title: "Firefly Constellation",
        description: "In the South-West garden, spirit fireflies drifted like fallen stars. Kaelo's staff beacon herded their light into three dormant braziers, and old lanterns burned again.",
        icon: "firefly",
    },
    {
        id: "mirrors",
        title: "Light of the Canopy",
        description: "In the South-East ruins, crystal prism pillars slept crooked. Turned with patience, they carried a beam of starlight through the stone gates into the root nexus.",
        icon: "mirror",
    },
];

// African pentatonic scale (C-D-E-G-A), two octaves.
const PENTA = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25];

class AudioEngine {
    private ctx: AudioContext | null = null;
    private master: GainNode | null = null;
    private sfxGain: GainNode | null = null;
    private bgmGain: GainNode | null = null;
    private ambienceNodes: AudioNode[] = [];
    private ambienceOn = false;
    private _sfxVol = 0.7;
    private _bgmVol = 0.5;

    private ensure(): boolean {
        try {
            if (!this.ctx) {
                const AC = window.AudioContext
                    || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
                if (!AC) return false;
                this.ctx = new AC();
                this.master = this.ctx.createGain();
                this.master.gain.value = 1;
                this.master.connect(this.ctx.destination);
                this.sfxGain = this.ctx.createGain();
                this.sfxGain.gain.value = this._sfxVol;
                this.sfxGain.connect(this.master);
                this.bgmGain = this.ctx.createGain();
                this.bgmGain.gain.value = this._bgmVol;
                this.bgmGain.connect(this.master);
            }
            if (this.ctx.state === "suspended") void this.ctx.resume();
            return true;
        } catch {
            return false;
        }
    }

    setVolumes(sfx: number, bgm: number) {
        this._sfxVol = sfx;
        this._bgmVol = bgm;
        if (this.sfxGain) this.sfxGain.gain.value = sfx;
        if (this.bgmGain) this.bgmGain.gain.value = bgm;
    }

    /** Warm kalimba / marimba bell tone. */
    kalimba(index: number, when = 0, dest?: GainNode) {
        if (!this.ensure() || !this.ctx) return;
        const freq = PENTA[Math.max(0, Math.min(PENTA.length - 1, index))];
        const t = this.ctx.currentTime + when;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.5, t + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
        g.connect(dest ?? this.sfxGain ?? this.ctx.destination);
        const o1 = this.ctx.createOscillator();
        o1.type = "triangle";
        o1.frequency.value = freq;
        const o2 = this.ctx.createOscillator();
        o2.type = "sine";
        o2.frequency.value = freq * 2.01;
        const g2 = this.ctx.createGain();
        g2.gain.value = 0.25;
        o1.connect(g);
        o2.connect(g2);
        g2.connect(g);
        o1.start(t); o2.start(t);
        o1.stop(t + 1.5); o2.stop(t + 1.5);
    }

    /** Shimmering crystal staff chime sweep. */
    chimeSweep() {
        if (!this.ensure() || !this.ctx) return;
        for (let i = 0; i < 4; i++) this.kalimba(2 + i, i * 0.06);
    }

    /** Soft UI / footstep tick. */
    blip(freq = 520, dur = 0.08, vol = 0.12) {
        if (!this.ensure() || !this.ctx) return;
        const t = this.ctx.currentTime;
        const o = this.ctx.createOscillator();
        o.type = "sine";
        o.frequency.value = freq;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(this.sfxGain ?? this.ctx.destination);
        o.start(t); o.stop(t + dur + 0.02);
    }

    /** Deep grounding bass boom for shrine awakening. */
    rootAwaken() {
        if (!this.ensure() || !this.ctx) return;
        const t = this.ctx.currentTime;
        const o = this.ctx.createOscillator();
        o.type = "sine";
        o.frequency.setValueAtTime(70, t);
        o.frequency.exponentialRampToValueAtTime(38, t + 1.2);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.6, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
        o.connect(g); g.connect(this.sfxGain ?? this.ctx.destination);
        o.start(t); o.stop(t + 1.7);
        const seq = [0, 2, 4, 5, 7];
        seq.forEach((n, i) => this.kalimba(n, 0.25 + i * 0.18));
    }

    /** Majestic ascending harmony for the Convergence finale. */
    fanfare() {
        if (!this.ensure() || !this.ctx) return;
        const seq = [0, 2, 4, 5, 7, 6, 7];
        seq.forEach((n, i) => this.kalimba(n, i * 0.22));
        this.rootAwaken();
    }

    /** Ancestral REMEMBER spirit-pulse hum: low swell + kalimba shimmer. */
    rememberPulse() {
        if (!this.ensure() || !this.ctx) return;
        const t = this.ctx.currentTime;
        const o = this.ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(96, t);
        o.frequency.exponentialRampToValueAtTime(320, t + 0.7);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.4, t + 0.18);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
        o.connect(g); g.connect(this.sfxGain ?? this.ctx.destination);
        o.start(t); o.stop(t + 1.2);
        [4, 5, 7].forEach((n, i) => this.kalimba(n, 0.12 + i * 0.14));
    }

    /** Soft savanna dust puff while sprinting (throttled by caller). */
    dust() {
        this.blip(170, 0.05, 0.05);
    }

    /** Gentle tutorial step completion bell. */
    tutorialPing() {
        this.kalimba(5);
        this.kalimba(7, 0.16);
    }

    /** Gentle savanna night ambience: filtered wind + cricket shimmer. */
    startAmbience() {
        if (!this.ensure() || !this.ctx || this.ambienceOn) return;
        this.ambienceOn = true;
        const ctx = this.ctx;
        // Wind: looping filtered noise with slow LFO on the filter cutoff.
        const len = ctx.sampleRate * 2;
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
        const noise = ctx.createBufferSource();
        noise.buffer = buf; noise.loop = true;
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass"; lp.frequency.value = 320; lp.Q.value = 0.6;
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.08;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 140;
        lfo.connect(lfoGain); lfoGain.connect(lp.frequency);
        const ng = ctx.createGain();
        ng.gain.value = 0.16;
        noise.connect(lp); lp.connect(ng); ng.connect(this.bgmGain ?? ctx.destination);
        noise.start(); lfo.start();
        // Low resonant savanna hum.
        const hum = ctx.createOscillator();
        hum.type = "sine"; hum.frequency.value = 55;
        const hg = ctx.createGain(); hg.gain.value = 0.05;
        hum.connect(hg); hg.connect(this.bgmGain ?? ctx.destination);
        hum.start();
        this.ambienceNodes = [noise, lfo, hum];
    }

    stopAmbience() {
        this.ambienceOn = false;
        this.ambienceNodes.forEach(n => {
            try { (n as OscillatorNode).stop(); } catch { /* already stopped */ }
            try { n.disconnect(); } catch { /* noop */ }
        });
        this.ambienceNodes = [];
    }

    /** Meditative kalimba menu melody loop (returns a stop handle). */
    startMenuMelody(): () => void {
        if (!this.ensure() || !this.ctx) return () => undefined;
        let stopped = false;
        const pattern = [0, 2, 4, 2, 5, 4, 2, 0];
        let step = 0;
        const id = window.setInterval(() => {
            if (stopped || !this.ctx) return;
            this.kalimba(pattern[step % pattern.length], 0, this.bgmGain ?? undefined);
            if (step % 4 === 0) this.kalimba(7, 0.4, this.bgmGain ?? undefined);
            step++;
        }, 620);
        return () => { stopped = true; window.clearInterval(id); };
    }
}

export const audioEngine = new AudioEngine();