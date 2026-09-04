import { AUTO, BlendModes, Events, Game as PhaserGame, Scale, Scene } from 'phaser';
import { audioEngine, ECHOES } from './utils';

// ---------------------------------------------------------------------------
// Echoes of the Baobab — Phaser 4 scene + procedural world.
// ---------------------------------------------------------------------------
export const GAME_WIDTH = 1024;
export const GAME_HEIGHT = 768;

export const WORLD_W = 3200;
export const WORLD_H = 2400;

export const COLORS = {
    SKY_TOP: 0x1a0f2e,
    EARTH: 0x8b3a2b,
    EARTH_DARK: 0x5a201b,
    GOLD: 0xffd166,
    EMERALD: 0x06d6a0,
    STAR: 0x118ab2,
    ROSE: 0xff70a6,
    BARK: 0x4a2e2b,
} as const;

// Event-name constants (shared with App.tsx so both sides can't drift).
export const EVT = {
    PHASE: 'phase-changed',
    START: 'start-game',
    OPEN_MEM: 'open-memories',
    OPEN_SET: 'open-settings',
    MEMORY: 'memory-unlocked',
    PUZZLE: 'puzzle-state-changed',
    HUD: 'hud-update',
    SOUND: 'sound-toggle',
    SCENE_READY: 'current-scene-ready',
} as const;

// ---------------------------------------------------------------------------
// EventBus — shared React <-> Phaser bridge (named export).
// ---------------------------------------------------------------------------
export const EventBus = new Events.EventEmitter();

// ---------------------------------------------------------------------------
// PROCEDURAL TEXTURE FACTORY — drawn with Graphics + generateTexture so every
// sprite is a real, visible multi-part shape (no dummy 1x1 textures).
// ---------------------------------------------------------------------------
function makeTextures(scene: Scene) {
    const g = scene.add.graphics();
    const tex = scene.textures;

    const finish = (key: string, w: number, h: number) => {
        if (!tex.exists(key)) g.generateTexture(key, w, h);
        g.clear();
    };

    // -- Ground earth tile (mottled red soil) --
    g.fillStyle(COLORS.EARTH, 1); g.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 26; i++) {
        g.fillStyle(i % 2 ? COLORS.EARTH_DARK : 0xb85232, 0.5);
        g.fillCircle(Math.random() * 64, Math.random() * 64, 2 + Math.random() * 3);
    }
    finish('earth', 64, 64);

    // -- Path stone (lighter packed clay) --
    g.fillStyle(0xd47a43, 1); g.fillRoundedRect(0, 0, 40, 40, 8);
    g.fillStyle(0xb85232, 0.6); g.fillRoundedRect(4, 4, 32, 32, 6);
    finish('stone', 40, 40);

    // -- Grass tuft (swaying savanna blade cluster) --
    g.lineStyle(3, 0x7fa643, 1);
    for (let i = -2; i <= 2; i++) {
        g.beginPath(); g.moveTo(16 + i * 4, 28); g.lineTo(16 + i * 5, 4 + Math.abs(i) * 4); g.strokePath();
    }
    g.lineStyle(2, 0xcfa052, 1);
    g.beginPath(); g.moveTo(14, 28); g.lineTo(10, 8); g.strokePath();
    finish('grass', 32, 30);

    // -- Rock mound --
    g.fillStyle(0x6a4038, 1); g.fillEllipse(20, 22, 38, 30);
    g.fillStyle(0x8a5a4a, 1); g.fillEllipse(16, 16, 26, 20);
    g.fillStyle(0xb8846a, 0.7); g.fillEllipse(13, 12, 12, 8);
    finish('rock', 40, 40);

    // -- Acacia tree (canopy + trunk) --
    g.fillStyle(COLORS.BARK, 1); g.fillRect(28, 40, 8, 44);
    g.fillStyle(0x3a2422, 1); g.fillRect(28, 40, 3, 44);
    g.fillStyle(0x2d5a37, 1); g.fillEllipse(32, 34, 72, 26);
    g.fillStyle(0x3f7a45, 1); g.fillEllipse(24, 28, 54, 22);
    g.fillStyle(0x7fa643, 0.6); g.fillEllipse(20, 24, 30, 12);
    finish('acacia', 64, 86);

    // -- Firefly (glow dot) --
    g.fillStyle(0xffd166, 0.35); g.fillCircle(8, 8, 8);
    g.fillStyle(0xfff2b0, 0.8); g.fillCircle(8, 8, 4);
    g.fillStyle(0xffffff, 1); g.fillCircle(8, 8, 2);
    finish('firefly', 16, 16);

    // -- Spark particle --
    g.fillStyle(0xffffff, 0.9); g.fillCircle(4, 4, 3);
    g.fillStyle(0xffd166, 0.6); g.fillCircle(4, 4, 4);
    finish('spark', 8, 8);

    // -- Savanna dust puff (sprint kick-up, warm terracotta) --
    g.fillStyle(0xd9a066, 0.55); g.fillCircle(6, 6, 6);
    g.fillStyle(0xb87a45, 0.35); g.fillCircle(9, 4, 4);
    finish('dust', 12, 12);

    // -- Spirit butterfly (ancestral guide wisp) --
    g.fillStyle(0xffd166, 0.85);
    g.fillEllipse(5, 8, 8, 12);
    g.fillEllipse(13, 8, 8, 12);
    g.fillStyle(0xfff3c4, 0.9);
    g.fillEllipse(5, 7, 4, 6);
    g.fillEllipse(13, 7, 4, 6);
    g.fillStyle(0x782939, 1); g.fillRect(8, 3, 2, 11);
    finish('butterfly', 18, 16);

    // -- Tutorial ground glyph (glowing spirit stepping stone) --
    g.fillStyle(0xffd166, 0.25); g.fillCircle(22, 22, 21);
    g.lineStyle(3, 0xffd166, 0.9); g.strokeCircle(22, 22, 15);
    g.lineStyle(2, 0xfff3c4, 0.8);
    g.beginPath(); g.moveTo(22, 10); g.lineTo(22, 34); g.strokePath();
    g.beginPath(); g.moveTo(10, 22); g.lineTo(34, 22); g.strokePath();
    g.fillStyle(0xfff3c4, 1); g.fillCircle(22, 22, 4);
    finish('tut_glyph', 44, 44);

    // -- Soft glow orb (for shrines / beacon) --
    for (let r = 24; r > 0; r--) {
        g.fillStyle(COLORS.GOLD, 0.05); g.fillCircle(24, 24, r);
    }
    finish('glow', 48, 48);

    // -- Chime stone (kalimba note) --
    g.fillStyle(0x6a4038, 1); g.fillRoundedRect(0, 6, 26, 34, 6);
    g.fillStyle(0x118ab2, 1); g.fillRoundedRect(4, 2, 18, 12, 4);
    g.fillStyle(0x7fd4ee, 1); g.fillRoundedRect(6, 4, 14, 6, 3);
    finish('chime', 26, 40);

    // -- Brazier (spirit lantern) --
    g.fillStyle(0x4a2e2b, 1); g.fillRect(8, 24, 16, 24);
    g.fillStyle(0x6a4038, 1); g.fillEllipse(16, 22, 30, 14);
    g.fillStyle(0x2a1a18, 1); g.fillEllipse(16, 20, 22, 9);
    finish('brazier', 32, 48);

    // -- Brazier flame --
    g.fillStyle(0xff7043, 0.9); g.fillEllipse(10, 14, 14, 24);
    g.fillStyle(0xffd166, 1); g.fillEllipse(10, 16, 8, 16);
    g.fillStyle(0xffffff, 0.8); g.fillEllipse(10, 20, 4, 8);
    finish('flame', 20, 30);

    // -- Mirror pillar --
    g.fillStyle(0x5a4a6a, 1); g.fillRect(6, 10, 20, 44);
    g.fillStyle(0x9fd8ff, 1); g.fillRect(9, 12, 14, 30);
    g.fillStyle(0xffffff, 0.7); g.fillRect(11, 14, 4, 26);
    g.fillStyle(0x3a2a4a, 1); g.fillRect(4, 6, 24, 8);
    finish('pillar', 32, 56);

    // -- Ring segment (sunstone dial) --
    g.fillStyle(0xb85232, 1); g.fillRoundedRect(0, 0, 60, 16, 8);
    g.fillStyle(0xffd166, 1); g.fillTriangle(24, 0, 36, 0, 30, 12);
    finish('ring', 60, 16);

    // -- Heart crystal --
    g.fillStyle(0x06d6a0, 1); g.fillTriangle(14, 0, 28, 14, 14, 28);
    g.fillTriangle(0, 14, 14, 0, 14, 28);
    g.fillStyle(0x9ff5d8, 0.8); g.fillTriangle(14, 6, 22, 14, 14, 22);
    finish('crystal', 28, 28);

    g.destroy();
}

// ---------------------------------------------------------------------------
// The Great Baobab — drawn once into a large canvas-free graphics texture.
// ---------------------------------------------------------------------------
function makeBaobab(scene: Scene) {
    if (scene.textures.exists('baobab')) return;
    const g = scene.add.graphics();
    const W = 420, H = 520;
    // Winding trunk
    g.fillStyle(COLORS.BARK, 1);
    g.fillRoundedRect(150, 180, 120, 320, 40);
    g.fillStyle(0x3a2422, 1);
    g.fillRoundedRect(150, 180, 40, 320, 20);
    // Root flares
    g.fillStyle(COLORS.BARK, 1);
    g.fillTriangle(150, 500, 90, 500, 150, 380);
    g.fillTriangle(270, 500, 330, 500, 270, 380);
    g.fillTriangle(190, 500, 230, 500, 210, 400);
    // Branch arms
    g.lineStyle(20, COLORS.BARK, 1);
    g.beginPath(); g.moveTo(210, 200); g.lineTo(120, 120); g.strokePath();
    g.beginPath(); g.moveTo(210, 200); g.lineTo(300, 110); g.strokePath();
    g.beginPath(); g.moveTo(210, 190); g.lineTo(210, 90); g.strokePath();
    // Tiered canopy
    const canopy = (x: number, y: number, rx: number, ry: number, c: number, a = 1) => {
        g.fillStyle(c, a); g.fillEllipse(x, y, rx, ry);
    };
    canopy(120, 110, 150, 70, 0x2d5a37);
    canopy(300, 100, 150, 72, 0x2d5a37);
    canopy(210, 70, 170, 80, 0x3f7a45);
    canopy(150, 80, 110, 60, 0x7fa643, 0.7);
    canopy(280, 70, 110, 58, 0x7fa643, 0.6);
    canopy(210, 50, 90, 50, 0xcfa052, 0.5);
    // Glowing carved runes on trunk
    g.fillStyle(COLORS.GOLD, 0.9);
    for (let i = 0; i < 4; i++) {
        g.fillRoundedRect(196, 250 + i * 55, 28, 8, 4);
        g.fillCircle(210, 240 + i * 55, 4);
    }
    g.generateTexture('baobab', W, H);
    g.destroy();
}

// ---------------------------------------------------------------------------
// Kaelo the Memory Keeper — 4-frame walk cycle texture (front-facing set).
// ---------------------------------------------------------------------------
function makeKaelo(scene: Scene) {
    if (scene.textures.exists('kaelo_walk')) return;
    const g = scene.add.graphics();
    const FW = 40, FH = 56;
    // Draw 4 frames into one horizontal spritesheet by generating per-frame then
    // we instead build a single frame set via canvas texture for animation.
    const ct = scene.textures.createCanvas('kaelo_walk', FW * 4, FH)!;
    const ctx = ct.getContext();
    const skin = '#5a3a2a';
    const vest1 = '#c8802a';
    const vest2 = '#06d6a0';
    const sash = '#782939';
    const draw = (fx: number, legSwing: number, bob: number) => {
        const x = fx * FW;
        ctx.save();
        ctx.translate(x, 0);
        // staff
        ctx.strokeStyle = '#4a2e2b'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(30, 14 + bob); ctx.lineTo(34, 50 + bob); ctx.stroke();
        ctx.fillStyle = '#ffd166'; ctx.beginPath(); ctx.arc(30, 12 + bob, 4, 0, Math.PI * 2); ctx.fill();
        // legs
        ctx.fillStyle = skin;
        ctx.fillRect(14 - legSwing, 38 + bob, 5, 16);
        ctx.fillRect(20 + legSwing, 38 + bob, 5, 16);
        // body vest
        ctx.fillStyle = vest1; ctx.fillRect(12, 22 + bob, 16, 18);
        ctx.fillStyle = vest2; ctx.fillRect(12, 22 + bob, 16, 5);
        ctx.fillStyle = sash; ctx.fillRect(12, 30 + bob, 16, 3);
        // arms
        ctx.fillStyle = skin; ctx.fillRect(9, 24 + bob, 4, 12); ctx.fillRect(27, 24 + bob, 4, 12);
        // head
        ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(20, 16 + bob, 8, 0, Math.PI * 2); ctx.fill();
        // hair / wrap
        ctx.fillStyle = '#2a1a14'; ctx.beginPath(); ctx.arc(20, 13 + bob, 8, Math.PI, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#c8802a'; ctx.fillRect(12, 9 + bob, 16, 3);
        // beaded necklace
        ctx.fillStyle = '#ffd166';
        for (let i = 0; i < 4; i++) ctx.fillRect(15 + i * 3, 22 + bob, 2, 2);
        ctx.restore();
    };
    draw(0, 0, 0);
    draw(1, 3, 1);
    draw(2, 0, 0);
    draw(3, -3, 1);
    ct.refresh();
    g.destroy();
}

// ---------------------------------------------------------------------------
// Shrine totem
// ---------------------------------------------------------------------------
function makeShrine(scene: Scene) {
    if (scene.textures.exists('shrine')) return;
    const g = scene.add.graphics();
    g.fillStyle(0x6a4038, 1); g.fillRoundedRect(6, 20, 36, 60, 8);
    g.fillStyle(0x4a2e2b, 1); g.fillRoundedRect(6, 20, 12, 60, 6);
    g.fillStyle(0x8a5a4a, 1); g.fillEllipse(24, 18, 44, 20);
    // mask face
    g.fillStyle(0xffd166, 1); g.fillEllipse(24, 44, 22, 30);
    g.fillStyle(0x782939, 1); g.fillEllipse(18, 40, 5, 8); g.fillEllipse(30, 40, 5, 8);
    g.fillStyle(0x2a1a14, 1); g.fillRect(18, 54, 12, 3);
    g.lineStyle(2, 0x2a1a14, 1); g.beginPath(); g.moveTo(24, 30); g.lineTo(24, 60); g.strokePath();
    if (!scene.textures.exists('shrine')) g.generateTexture('shrine', 48, 80);
    g.destroy();
}

// ---------------------------------------------------------------------------
// THE GAME SCENE
// ---------------------------------------------------------------------------
type PuzzleId = 'roots' | 'sunstone' | 'fireflies' | 'mirrors';

interface ShrineState {
    id: PuzzleId;
    x: number; y: number;
    solved: boolean;
    totem: Phaser.GameObjects.Image;
    glow: Phaser.GameObjects.Image;
    label: string;
}

interface TutorialStep {
    id: 'move' | 'sprint' | 'remember' | 'interact';
    x: number; y: number;
    done: boolean;
    glyph: Phaser.GameObjects.Image;
    label: Phaser.GameObjects.Text;
    aura: Phaser.GameObjects.Image;
}

const WALK_SPEED = 180;
const SPRINT_SPEED = 320;
const ACCEL = 1200;        // px/s^2 toward target velocity
const FRICTION = 900;      // px/s^2 deceleration when idle
const REMEMBER_CD = 6000;  // ms cooldown

export class Game extends Scene {
    private player!: Phaser.Physics.Arcade.Sprite;
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private keys!: Record<string, Phaser.Input.Keyboard.Key>;
    private world!: Phaser.GameObjects.Container;

    private fireflies: Phaser.GameObjects.Image[] = [];
    private grasses: Phaser.GameObjects.Image[] = [];
    private shrines: ShrineState[] = [];
    private rootLines: Phaser.GameObjects.Graphics;

    // puzzle runtime
    private activePuzzle: PuzzleId | null = null;
    private echoCount = 0;
    private startTime = 0;
    private elapsed = 0;

    // Roots puzzle (chime sequence)
    private chimeStones: Phaser.GameObjects.Image[] = [];
    private chimeTarget: number[] = [];
    private chimeInput: number[] = [];
    private chimeShowing = false;

    // Sunstone puzzle (rings)
    private rings: Phaser.GameObjects.Image[] = [];
    private ringAngles = [0, 0, 0];
    private ringTarget = [2, 1, 3]; // quarter-steps to align

    // Firefly puzzle
    private beacon!: Phaser.GameObjects.Image;
    private brazierLights: { brazier: Phaser.GameObjects.Image; flame: Phaser.GameObjects.Image; lit: boolean }[] = [];
    private herdedFireflies: Phaser.GameObjects.Image[] = [];

    // Mirror puzzle
    private mirrors: Phaser.GameObjects.Image[] = [];
    private mirrorAngles = [0, 0, 0];
    private mirrorTarget = [1, 2, 3];
    private lightBeam!: Phaser.GameObjects.Graphics;

    private promptText = '';
    private currentZone = 'The Baobab Sanctuary';
    private touchMove = { x: 0, y: 0 };
    private isTouch = false;

    // ---- Enhanced third-person movement / camera ----
    private curVel = { x: 0, y: 0 };
    private facing = 0;            // radians toward cursor / movement
    private camOffset = { x: 0, y: 0 };
    private camTarget = { x: 0, y: 0 };
    private sprinting = false;
    private lastDust = 0;
    private lastStep = 0;
    private dustEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;

    // ---- REMEMBER spirit ability ----
    private rememberReadyAt = 0;
    private rememberActive = false;
    private pulseRing!: Phaser.GameObjects.Graphics;
    private wisps: Phaser.GameObjects.Image[] = [];
    private beacons: Phaser.GameObjects.Image[] = [];
    private hiddenGlyphs: Phaser.GameObjects.Image[] = [];

    // ---- Environmental tutorial ----
    private tutSteps: TutorialStep[] = [];
    private tutDone = 0;
    private tutGroup!: Phaser.GameObjects.Group;

    constructor() {
        super('Game');
    }

    create() {
        this.isTouch = this.sys.game.device.input.touch;
        makeTextures(this);
        makeBaobab(this);
        makeKaelo(this);
        makeShrine(this);

        // ---- WORLD CONTAINER (everything scrolls together) ----
        this.world = this.add.container(0, 0);
        this.add.existing(this.world);

        // Sky backdrop (fixed, behind camera pan via parallax)
        const sky = this.add.graphics();
        sky.fillGradientStyle(COLORS.SKY_TOP, COLORS.SKY_TOP, 0x782939, 0xe58239, 1);
        sky.fillRect(0, 0, WORLD_W, WORLD_H);
        sky.setScrollFactor(0.2);
        this.world.add(sky);

        // Distant hills silhouettes (parallax)
        const hills = this.add.graphics();
        hills.fillStyle(0x3a1f3a, 0.8);
        for (let i = 0; i < 8; i++) {
            hills.fillEllipse(200 + i * 420, 520, 520, 260);
        }
        hills.setScrollFactor(0.35);
        this.world.add(hills);

        // Earth tilemap-ish grid
        const earth = this.add.graphics();
        earth.fillStyle(COLORS.EARTH, 1);
        earth.fillRect(0, 0, WORLD_W, WORLD_H);
        this.world.add(earth);
        for (let y = 0; y < WORLD_H; y += 64) {
            for (let x = 0; x < WORLD_W; x += 64) {
                const t = this.add.image(x + 32, y + 32, 'earth');
                t.setScrollFactor(1);
                this.world.add(t);
            }
        }

        // Central plaza stone ring
        const plaza = this.add.graphics();
        plaza.fillStyle(0xd47a43, 0.5);
        plaza.fillCircle(WORLD_W / 2, WORLD_H / 2, 260);
        this.world.add(plaza);

        // The Great Baobab at center
        const baobab = this.add.image(WORLD_W / 2, WORLD_H / 2 - 120, 'baobab');
        baobab.setDepth(5);
        this.world.add(baobab);
        // glowing aura behind baobab
        const aura = this.add.image(WORLD_W / 2, WORLD_H / 2 - 160, 'glow');
        aura.setScale(6).setTint(COLORS.GOLD).setAlpha(0.4).setDepth(4);
        this.world.add(aura);
        this.tweens.add({ targets: aura, alpha: 0.15, scale: 5.2, yoyo: true, repeat: -1, duration: 2600 });

        // Scatter decor: acacias, rocks, grass
        const rand = (a: number, b: number) => a + Math.random() * (b - a);
        for (let i = 0; i < 46; i++) {
            const x = rand(120, WORLD_W - 120), y = rand(120, WORLD_H - 120);
            if (Math.hypot(x - WORLD_W / 2, y - WORLD_H / 2) < 320) continue;
            const t = this.add.image(x, y, 'acacia'); t.setDepth(y / 100);
            this.world.add(t);
        }
        for (let i = 0; i < 40; i++) {
            const x = rand(100, WORLD_W - 100), y = rand(100, WORLD_H - 100);
            const t = this.add.image(x, y, 'rock'); t.setDepth(y / 100);
            this.world.add(t);
        }
        for (let i = 0; i < 130; i++) {
            const x = rand(60, WORLD_W - 60), y = rand(60, WORLD_H - 60);
            const t = this.add.image(x, y, 'grass'); t.setDepth(y / 100);
            this.grasses.push(t);
            this.world.add(t);
            this.tweens.add({
                targets: t, angle: rand(-6, 6), duration: rand(1200, 2400),
                yoyo: true, repeat: -1, ease: 'Sine.inOut', delay: rand(0, 1500),
            });
        }

        // Hidden ancestral footstep glyphs — invisible until REMEMBER reveals them
        for (let i = 0; i < 10; i++) {
            const a = (i / 10) * Math.PI * 2;
            const r = 380 + (i % 3) * 90;
            const gl = this.add.image(WORLD_W / 2 + Math.cos(a) * r, WORLD_H / 2 + Math.sin(a) * r, 'tut_glyph');
            gl.setScale(0.7).setAlpha(0).setDepth(2).setTint(COLORS.EMERALD);
            this.hiddenGlyphs.push(gl);
            this.world.add(gl);
        }

        // Fireflies (ambient drifting)
        for (let i = 0; i < 70; i++) {
            const f = this.add.image(rand(100, WORLD_W - 100), rand(100, WORLD_H - 100), 'firefly');
            f.setDepth(20).setBlendMode(BlendModes.ADD);
            this.fireflies.push(f);
            this.world.add(f);
            this.driftFirefly(f);
        }

        // ---- PHYSICS PLAYER ----
        this.player = this.physics.add.sprite(WORLD_W / 2, WORLD_H / 2 + 220, 'kaelo_walk');
        this.player.setFrame(0);
        this.player.setScale(1.6);
        this.player.setDepth(10);
        this.player.body!.setSize(20, 26).setOffset(10, 26);
        this.world.add(this.player);
        this.physics.add.collider(this.player, []); // no static colliders; bounds handle edges

        // Sprint dust emitter (sitting at the player's feet, spawned on demand)
        this.dustEmitter = this.add.particles(0, 0, 'dust', {
            speed: { min: 10, max: 60 },
            angle: { min: 200, max: 340 },
            scale: { start: 1.1, end: 0 },
            alpha: { start: 0.7, end: 0 },
            lifespan: 520,
            quantity: 2,
            frequency: -1,
            tint: [0xd9a066, 0xb87a45],
            blendMode: BlendModes.NORMAL,
        });
        this.dustEmitter.setDepth(9);
        this.world.add(this.dustEmitter);

        // Player glow
        const pg = this.add.image(0, 0, 'glow');
        pg.setScale(2.2).setTint(COLORS.EMERALD).setAlpha(0.35).setDepth(9);
        this.world.add(pg);
        this.tweens.add({
            targets: pg, alpha: 0.15, scale: 1.8, yoyo: true, repeat: -1, duration: 1400,
        });
        this.events.on('preupdate', () => {
            pg.x = this.player.x; pg.y = this.player.y + 6;
        });

        // ---- SHRINES (4 quadrant puzzle anchors) ----
        const shrineDefs: { id: PuzzleId; x: number; y: number; label: string }[] = [
            { id: 'roots', x: 620, y: 560, label: 'Chime Grove' },
            { id: 'sunstone', x: WORLD_W - 620, y: 560, label: 'Sun Altar' },
            { id: 'fireflies', x: 620, y: WORLD_H - 560, label: 'Firefly Garden' },
            { id: 'mirrors', x: WORLD_W - 620, y: WORLD_H - 560, label: 'Mirror Ruins' },
        ];
        for (const d of shrineDefs) {
            const totem = this.add.image(d.x, d.y, 'shrine'); totem.setDepth(d.y / 100);
            const glow = this.add.image(d.x, d.y - 10, 'glow');
            glow.setScale(3).setTint(COLORS.GOLD).setAlpha(0.25).setDepth((d.y / 100) - 0.1);
            this.world.add(totem); this.world.add(glow);
            this.shrines.push({ id: d.id, x: d.x, y: d.y, solved: false, totem, glow, label: d.label });
            // root line from shrine to baobab (drawn later when solved)
        }
        this.rootLines = this.add.graphics();
        this.rootLines.setDepth(3);
        this.world.add(this.rootLines);

        // ---- REMEMBER pulse ring (graphics, animated on trigger) ----
        this.pulseRing = this.add.graphics();
        this.pulseRing.setDepth(40).setBlendMode(BlendModes.ADD);
        this.world.add(this.pulseRing);

        // ---- ENVIRONMENTAL TUTORIAL stepping stones around the Baobab ----
        this.tutGroup = this.add.group();
        const defs: { id: TutorialStep['id']; a: number; text: string }[] = [
            { id: 'move', a: -0.5, text: '[W A S D]  Walk the earth' },
            { id: 'sprint', a: 0.6, text: '[Shift]  Run with the wind' },
            { id: 'remember', a: 2.1, text: '[R]  Remember — call the ancestors' },
            { id: 'interact', a: 3.6, text: '[E]  Commune with a glowing shrine' },
        ];
        for (const d of defs) {
            const r = 330;
            const x = WORLD_W / 2 + Math.cos(d.a) * r;
            const y = WORLD_H / 2 + Math.sin(d.a) * r * 0.8;
            const glyph = this.add.image(x, y + 26, 'tut_glyph').setScale(1.15).setDepth(8).setAlpha(0.9);
            const aura = this.add.image(x, y + 26, 'glow').setScale(2.4).setTint(COLORS.GOLD).setAlpha(0.35).setDepth(7);
            const label = this.add.text(x, y - 14, d.text, {
                fontFamily: '"Trebuchet MS", "Segoe UI", sans-serif',
                fontSize: '15px', fontStyle: 'bold', color: '#ffe9c2',
                stroke: '#1a0f2e', strokeThickness: 4,
            }).setOrigin(0.5).setDepth(30);
            this.world.add(glyph); this.world.add(aura); this.world.add(label);
            this.tutGroup.addMultiple([glyph, aura, label]);
            this.tweens.add({ targets: aura, alpha: 0.15, scale: 2.0, yoyo: true, repeat: -1, duration: 1500 });
            this.tweens.add({ targets: glyph, y: y + 20, yoyo: true, repeat: -1, duration: 1200, ease: 'Sine.inOut' });
            this.tutSteps.push({ id: d.id, x, y, done: false, glyph, label, aura });
        }

        // ---- CAMERA ----
        this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H);
        this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
        this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
        this.cameras.main.setBackgroundColor(COLORS.SKY_TOP);
        this.player.setCollideWorldBounds(true);

        // ---- INPUT ----
        this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,SHIFT,E,R,M,ESCAPE,P') as Record<string, Phaser.Input.Keyboard.Key>;
        this.cursors = this.input.keyboard!.createCursorKeys();
        this.input.keyboard!.on('keydown-ESCAPE', () => this.togglePause());
        this.input.keyboard!.on('keydown-P', () => this.togglePause());
        this.input.keyboard!.on('keydown-E', () => this.interact());
        this.input.keyboard!.on('keydown-SPACE', () => this.interact());
        this.input.keyboard!.on('keydown-R', () => this.remember());
        this.input.on('pointerdown', (p: Phaser.Input.Pointer) => { if (this.isTouch) this.interact(); });

        // Touch joystick state (React sends via EventBus 'touch-move')
        EventBus.on('touch-move', (v: { x: number; y: number }) => { this.touchMove = v; });
        EventBus.on('touch-remember', () => this.remember());

        // React -> scene commands
        EventBus.on(EVT.START, () => this.beginExploration());
        EventBus.on('toggle-pause', () => this.togglePause());
        EventBus.on('touch-interact', () => this.interact());
        EventBus.on('return-menu', () => this.scene.restart());
        EventBus.on('remember-ability', () => this.remember());

        // Start in MENU — the scene idles with a gentle camera pan until BEGIN JOURNEY
        this.menuMode = true;
        this.cameras.main.stopFollow();
        this.tweens.add({
            targets: this.cameras.main, scrollX: 200, scrollY: 120, duration: 12000, yoyo: true, repeat: -1, ease: 'Sine.inOut',
        });
        EventBus.emit(EVT.PHASE, 'MENU');
        EventBus.emit(EVT.SCENE_READY, this);

        this.events.once('shutdown', () => {
            this.time.removeAllEvents();
            this.tweens.killAll();
            this.input.keyboard?.removeAllListeners();
            EventBus.off(EVT.START);
            EventBus.off('toggle-pause');
            EventBus.off('touch-interact');
            EventBus.off('return-menu');
            EventBus.off('touch-move');
            EventBus.off('touch-remember');
            EventBus.off('remember-ability');
            audioEngine.stopAmbience();
        });
    }

    private menuMode = true;

    private driftFirefly(f: Phaser.GameObjects.Image) {
        const rand = (a: number, b: number) => a + Math.random() * (b - a);
        this.tweens.add({
            targets: f,
            x: f.x + rand(-90, 90),
            y: f.y + rand(-70, 70),
            alpha: rand(0.2, 1),
            duration: rand(2200, 5200),
            yoyo: true, repeat: -1, ease: 'Sine.inOut',
            onComplete: () => this.driftFirefly(f),
        });
    }

    private beginExploration() {
        this.menuMode = false;
        this.elapsed = 0;
        this.startTime = this.time.now;
        this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
        this.tweens.killTweensOf(this.cameras.main);
        audioEngine.startAmbience();
        EventBus.emit(EVT.PHASE, 'PLAYING');
        this.pushHud();
    }

    private togglePause() {
        if (this.menuMode) return;
        // toggle by emitting; App drives overlay
        EventBus.emit(EVT.PHASE, this.paused ? 'PLAYING' : 'PAUSED');
        this.paused = !this.paused;
        if (this.paused) { this.physics.world.pause(); this.tweens.pauseAll(); }
        else { this.physics.world.resume(); this.tweens.resumeAll(); }
    }
    private paused = false;

    private nearestShrine(): ShrineState | null {
        let best: ShrineState | null = null; let bd = 150;
        for (const s of this.shrines) {
            const d = Math.hypot(this.player.x - s.x, this.player.y - s.y);
            if (d < bd) { bd = d; best = s; }
        }
        return best;
    }

    // -----------------------------------------------------------------------
    // REMEMBER — ancestral spirit pulse (R)
    // -----------------------------------------------------------------------
    private remember() {
        if (this.menuMode || this.paused || this.rememberActive) return;
        if (this.time.now < this.rememberReadyAt) return;
        this.rememberActive = true;
        this.rememberReadyAt = this.time.now + REMEMBER_CD;
        audioEngine.rememberPulse();
        this.tutComplete('remember');

        const px = this.player.x, py = this.player.y;

        // Expanding golden wave ring
        const ringState = { r: 10, a: 0.9 };
        this.tweens.add({
            targets: ringState, r: 900, a: 0, duration: 1600, ease: 'Cubic.easeOut',
            onUpdate: () => {
                this.pulseRing.clear();
                this.pulseRing.lineStyle(6, COLORS.GOLD, ringState.a);
                this.pulseRing.strokeCircle(px, py, ringState.r);
                this.pulseRing.lineStyle(2, 0xfff3c4, ringState.a * 0.7);
                this.pulseRing.strokeCircle(px, py, ringState.r * 0.82);
            },
            onComplete: () => { this.pulseRing.clear(); },
        });

        // Reveal hidden ancestral footstep glyphs near the pulse
        for (const gl of this.hiddenGlyphs) {
            const d = Math.hypot(gl.x - px, gl.y - py);
            if (d < 950) {
                this.tweens.add({ targets: gl, alpha: 0.85, duration: 400, delay: d * 0.9 });
                this.tweens.add({ targets: gl, alpha: 0, duration: 1800, delay: 1400 + d * 0.9 });
            }
        }

        // Highlight unsolved shrines with beacon beams
        const unsolved = this.shrines.filter(s => !s.solved);
        for (const s of unsolved) {
            const beam = this.add.image(s.x, s.y - 140, 'glow');
            beam.setScale(1.6, 7).setTint(COLORS.GOLD).setAlpha(0).setDepth(25).setBlendMode(BlendModes.ADD);
            this.world.add(beam);
            this.beacons.push(beam);
            this.tweens.add({
                targets: beam, alpha: { from: 0, to: 0.55 }, duration: 500, yoyo: true, hold: 2600,
                onComplete: () => { beam.destroy(); this.beacons = this.beacons.filter(b => b !== beam); },
            });
        }

        // Guide wisps: spirit butterflies drifting toward the nearest unsolved shrine
        const target = unsolved.sort((a, b) =>
            Math.hypot(a.x - px, a.y - py) - Math.hypot(b.x - px, b.y - py))[0];
        if (target) {
            const count = 6;
            for (let i = 0; i < count; i++) {
                const w = this.add.image(px, py - 10, 'butterfly');
                w.setDepth(41).setBlendMode(BlendModes.ADD).setScale(1.3).setAlpha(0);
                w.setTint(i % 2 ? COLORS.GOLD : 0xfff3c4);
                this.world.add(w);
                this.wisps.push(w);
                const t = i / (count - 1);
                const mx = px + (target.x - px) * t + (Math.random() * 90 - 45);
                const my = py + (target.y - py) * t + (Math.random() * 60 - 30);
                this.tweens.add({ targets: w, alpha: 0.95, duration: 350, delay: i * 120 });
                this.tweens.add({
                    targets: w, x: mx, y: my, duration: 900 + i * 160, delay: i * 120,
                    ease: 'Sine.easeInOut',
                    onComplete: () => {
                        // flutter around waypoint
                        this.tweens.add({
                            targets: w,
                            x: mx + (Math.random() * 40 - 20),
                            y: my - 14 + (Math.random() * 24 - 12),
                            angle: Math.random() * 24 - 12,
                            duration: 500 + Math.random() * 400, yoyo: true, repeat: 5, ease: 'Sine.inOut',
                        });
                        this.tweens.add({
                            targets: w, alpha: 0, delay: 3200, duration: 900,
                            onComplete: () => { w.destroy(); this.wisps = this.wisps.filter(x => x !== w); },
                        });
                    },
                });
            }
        }

        this.time.delayedCall(2400, () => { this.rememberActive = false; });
        this.pushHud();
    }

    // -----------------------------------------------------------------------
    // Environmental tutorial step completion
    // -----------------------------------------------------------------------
    private tutComplete(id: TutorialStep['id']) {
        const s = this.tutSteps.find(t => t.id === id);
        if (!s || s.done) return;
        s.done = true;
        this.tutDone++;
        audioEngine.tutorialPing();
        this.tweens.add({
            targets: [s.glyph, s.aura, s.label],
            alpha: 0, y: s.glyph.y - 30, duration: 1200, ease: 'Sine.easeIn',
            onComplete: () => { s.glyph.destroy(); s.aura.destroy(); s.label.destroy(); },
        });
        if (this.tutDone >= this.tutSteps.length) {
            // whole path complete — a final blessing shimmer on the Baobab
            this.tweens.add({
                targets: this.player, scaleX: 1.9, scaleY: 1.9, yoyo: true, repeat: 1, duration: 220,
            });
        }
    }

    private interact() {
        if (this.menuMode || this.paused) return;
        // If a puzzle is open, feed the interact to it
        if (this.activePuzzle) { this.puzzleInteract(); return; }
        const s = this.nearestShrine();
        if (!s || s.solved) return;
        this.tutComplete('interact');
        this.openPuzzle(s);
    }

    private openPuzzle(s: ShrineState) {
        this.activePuzzle = s.id;
        audioEngine.chimeSweep();
        this.buildPuzzle(s.id, s.x, s.y);
        EventBus.emit(EVT.PUZZLE, { activePuzzle: s.id, progress: 0 });
    }

    private closePuzzle() {
        this.clearPuzzleObjects();
        this.activePuzzle = null;
        EventBus.emit(EVT.PUZZLE, { activePuzzle: null, progress: 0 });
    }

    private puzzleObj: Phaser.GameObjects.GameObject[] = [];
    private clearPuzzleObjects() {
        this.puzzleObj.forEach(o => o.destroy());
        this.puzzleObj = [];
        this.chimeStones = []; this.rings = []; this.mirrors = [];
        this.brazierLights = []; this.herdedFireflies = [];
        if (this.lightBeam) { this.lightBeam.destroy(); }
        if (this.beacon) { this.beacon.setVisible(false); }
    }

    private buildPuzzle(id: PuzzleId, cx: number, cy: number) {
        // Puzzle objects live in world space near the shrine, drawn above player
        const add = (o: Phaser.GameObjects.GameObject) => { this.puzzleObj.push(o); this.world.add(o); };
        if (id === 'roots') {
            const notes = [0, 2, 4, 5, 7];
            this.chimeTarget = [];
            for (let i = 0; i < 4; i++) this.chimeTarget.push(notes[Math.floor(Math.random() * notes.length)]);
            for (let i = 0; i < 5; i++) {
                const st = this.add.image(cx - 80 + i * 40, cy + 60, 'chime').setDepth(30);
                add(st);
                this.chimeStones.push(st);
                st.setData('note', notes[i]);
            }
            // play the target sequence
            this.chimeShowing = true;
            this.chimeTarget.forEach((n, i) => this.time.delayedCall(300 + i * 500, () => {
                audioEngine.kalimba(n);
                const st = this.chimeStones.find(s => s.getData('note') === n);
                if (st) this.tweens.add({ targets: st, scaleY: 1.4, yoyo: true, repeat: 1, duration: 180, tint: COLORS.GOLD });
            }));
            this.time.delayedCall(300 + this.chimeTarget.length * 500, () => { this.chimeShowing = false; });
            this.chimeInput = [];
        } else if (id === 'sunstone') {
            this.ringAngles = [0, 0, 0];
            this.ringTarget = [1 + Math.floor(Math.random() * 3), 1 + Math.floor(Math.random() * 3), 1 + Math.floor(Math.random() * 3)];
            for (let i = 0; i < 3; i++) {
                const r = this.add.image(cx, cy - 10, 'ring').setDepth(30 + i);
                r.setScale(1.4 + i * 0.8).setRotation(this.ringAngles[i] * Math.PI / 2);
                add(r); this.rings.push(r);
                r.setData('idx', i);
            }
            const cr = this.add.image(cx, cy - 10, 'crystal').setDepth(40); add(cr);
        } else if (id === 'fireflies') {
            this.beacon = this.add.image(cx, cy, 'glow').setScale(3).setTint(COLORS.EMERALD).setDepth(35).setVisible(false);
            add(this.beacon);
            const spots = [[-70, -30], [0, -70], [70, -30]];
            spots.forEach(([ox, oy]) => {
                const b = this.add.image(cx + ox, cy + oy, 'brazier').setDepth(30);
                const fl = this.add.image(cx + ox, cy + oy - 24, 'flame').setDepth(31).setVisible(false);
                add(b); add(fl);
                this.brazierLights.push({ brazier: b, flame: fl, lit: false });
            });
            this.herdedFireflies = [];
            for (let i = 0; i < 8; i++) {
                const f = this.add.image(cx + (Math.random() * 200 - 100), cy + (Math.random() * 120 - 60), 'firefly')
                    .setDepth(34).setBlendMode(BlendModes.ADD);
                add(f); this.herdedFireflies.push(f);
            }
        } else if (id === 'mirrors') {
            this.mirrorAngles = [0, 0, 0];
            this.mirrorTarget = [1 + Math.floor(Math.random() * 3), 1 + Math.floor(Math.random() * 3), 1 + Math.floor(Math.random() * 3)];
            for (let i = 0; i < 3; i++) {
                const p = this.add.image(cx - 70 + i * 70, cy - 10, 'pillar').setDepth(30);
                p.setData('idx', i); add(p); this.mirrors.push(p);
            }
            this.lightBeam = this.add.graphics().setDepth(33); add(this.lightBeam);
        }
    }

    private puzzleInteract() {
        const id = this.activePuzzle; if (!id) return;
        if (id === 'roots') {
            if (this.chimeShowing) return;
            // find nearest chime stone to player
            let best: Phaser.GameObjects.Image | null = null; let bd = 70;
            for (const s of this.chimeStones) {
                const d = Math.hypot(this.player.x - s.x, this.player.y - s.y);
                if (d < bd) { bd = d; best = s; }
            }
            if (!best) return;
            const note = best.getData('note') as number;
            audioEngine.kalimba(note);
            this.tweens.add({ targets: best, scaleY: 1.3, yoyo: true, duration: 120 });
            this.chimeInput.push(note);
            const ok = this.chimeInput.every((n, i) => n === this.chimeTarget[i]);
            if (!ok) { this.chimeInput = []; }
            else if (this.chimeInput.length === this.chimeTarget.length) { this.solvePuzzle('roots'); }
        } else if (id === 'sunstone') {
            // rotate nearest ring
            let best: Phaser.GameObjects.Image | null = null; let bd = 90;
            for (const r of this.rings) {
                const d = Math.hypot(this.player.x - r.x, this.player.y - r.y);
                if (d < bd) { bd = d; best = r; }
            }
            if (!best) return;
            const idx = best.getData('idx') as number;
            this.ringAngles[idx] = (this.ringAngles[idx] + 1) % 4;
            this.tweens.add({ targets: best, rotation: this.ringAngles[idx] * Math.PI / 2, duration: 220, ease: 'Back.easeOut' });
            audioEngine.blip(300 + idx * 120);
            if (this.ringAngles.every((a, i) => a === this.ringTarget[i])) this.solvePuzzle('sunstone');
        } else if (id === 'fireflies') {
            // toggle beacon: attracts fireflies toward player/braziers
            this.beacon.setVisible(!this.beacon.visible);
            audioEngine.chimeSweep();
        } else if (id === 'mirrors') {
            let best: Phaser.GameObjects.Image | null = null; let bd = 70;
            for (const m of this.mirrors) {
                const d = Math.hypot(this.player.x - m.x, this.player.y - m.y);
                if (d < bd) { bd = d; best = m; }
            }
            if (!best) return;
            const idx = best.getData('idx') as number;
            this.mirrorAngles[idx] = (this.mirrorAngles[idx] + 1) % 4;
            audioEngine.blip(420 + idx * 80);
            if (this.mirrorAngles.every((a, i) => a === this.mirrorTarget[i])) this.solvePuzzle('mirrors');
        }
    }

    private solvePuzzle(id: PuzzleId) {
        const s = this.shrines.find(sh => sh.id === id);
        if (!s || s.solved) return;
        s.solved = true;
        this.echoCount++;
        audioEngine.rootAwaken();
        // root light pulse to baobab
        this.rootLines.lineStyle(6, COLORS.GOLD, 0.9);
        this.rootLines.beginPath();
        this.rootLines.moveTo(s.x, s.y);
        this.rootLines.lineTo(WORLD_W / 2, WORLD_H / 2);
        this.rootLines.strokePath();
        this.tweens.add({ targets: s.glow, alpha: 0.7, scale: 4, duration: 900 });
        s.totem.setTint(COLORS.GOLD);
        const info = ECHOES.find(e => e.id === id)!;
        EventBus.emit(EVT.MEMORY, { ...info, count: this.echoCount });
        this.closePuzzle();
        this.pushHud();
        if (this.echoCount >= 4) {
            this.time.delayedCall(1200, () => this.triggerConvergence());
        }
    }

    private triggerConvergence() {
        audioEngine.fanfare();
        this.cameras.main.fade(800, 255, 215, 102);
        this.tweens.add({
            targets: this.cameras.main, zoom: 1.25, duration: 1600, yoyo: true,
        });
        // golden aurora burst
        for (let i = 0; i < 60; i++) {
            const sp = this.add.image(WORLD_W / 2, WORLD_H / 2 - 160, 'spark')
                .setDepth(50).setBlendMode(BlendModes.ADD).setTint(COLORS.GOLD);
            this.world.add(sp);
            const ang = Math.random() * Math.PI * 2, dist = 120 + Math.random() * 400;
            this.tweens.add({
                targets: sp, x: sp.x + Math.cos(ang) * dist, y: sp.y + Math.sin(ang) * dist,
                alpha: 0, scale: 0.2, duration: 1400 + Math.random() * 800, ease: 'Cubic.easeOut',
                onComplete: () => sp.destroy(),
            });
        }
        this.time.delayedCall(1800, () => {
            EventBus.emit(EVT.PHASE, 'FINISHED');
        });
    }

    private pushHud() {
        const s = this.nearestShrine();
        let prompt = '';
        let zone = this.currentZone;
        if (this.activePuzzle) {
            const map: Record<PuzzleId, string> = {
                roots: 'Repeat the singing stones in harmony',
                sunstone: 'Align the solar rings to the heart crystal',
                fireflies: 'Raise your beacon and herd fireflies to the braziers',
                mirrors: 'Turn the mirror pillars to channel the light',
            };
            prompt = map[this.activePuzzle];
            zone = this.shrines.find(sh => sh.id === this.activePuzzle)?.label ?? zone;
        } else if (s && !s.solved) {
            prompt = `Press [E] to commune with the ${s.label}`;
            zone = s.label;
        } else if (s && s.solved) {
            zone = s.label;
        }
        this.promptText = prompt;
        this.currentZone = zone;
        const rememberReady = Math.max(0, Math.min(1, 1 - (this.rememberReadyAt - this.time.now) / REMEMBER_CD));
        EventBus.emit(EVT.HUD, {
            echoesRestored: this.echoCount,
            totalEchoes: 4,
            currentZone: zone,
            promptText: prompt,
            rememberReady,
            sprintActive: this.sprinting,
        });
    }

    update(time: number, delta: number) {
        if (this.menuMode || this.paused) return;
        const dt = Math.min(delta, 50) / 1000; // seconds, clamped
        this.elapsed = (this.time.now - this.startTime) / 1000;

        // ---- Input vector (WASD / arrows / touch joystick) ----
        let vx = 0, vy = 0;
        const k = this.keys;
        if (k.A.isDown || k.LEFT.isDown || this.cursors.left.isDown) vx -= 1;
        if (k.D.isDown || k.RIGHT.isDown || this.cursors.right.isDown) vx += 1;
        if (k.W.isDown || k.UP.isDown || this.cursors.up.isDown) vy -= 1;
        if (k.S.isDown || k.DOWN.isDown || this.cursors.down.isDown) vy += 1;
        if (this.isTouch && (this.touchMove.x || this.touchMove.y)) { vx = this.touchMove.x; vy = this.touchMove.y; }

        const len = Math.hypot(vx, vy);
        if (len > 1) { vx /= len; vy /= len; }

        // ---- Sprint ----
        const wantSprint = !!(k.SHIFT && k.SHIFT.isDown) && len > 0;
        this.sprinting = wantSprint;
        const speed = wantSprint ? SPRINT_SPEED : WALK_SPEED;
        if (wantSprint) this.tutComplete('sprint');
        if (len > 0) this.tutComplete('move');

        // ---- Smooth acceleration / friction toward target velocity ----
        const tvx = vx * speed, tvy = vy * speed;
        const rate = len > 0 ? ACCEL : FRICTION;
        const step = rate * dt;
        this.curVel.x = Math.abs(tvx - this.curVel.x) <= step ? tvx : this.curVel.x + Math.sign(tvx - this.curVel.x) * step;
        this.curVel.y = Math.abs(tvy - this.curVel.y) <= step ? tvy : this.curVel.y + Math.sign(tvy - this.curVel.y) * step;
        this.player.setVelocity(this.curVel.x, this.curVel.y);

        const moving = Math.hypot(this.curVel.x, this.curVel.y) > 12;

        // ---- Mouse cursor facing + look-ahead camera ----
        const pointer = this.input.activePointer;
        if (!this.isTouch && pointer) {
            const dx = pointer.worldX - this.player.x;
            const dy = pointer.worldY - this.player.y;
            if (Math.hypot(dx, dy) > 24) this.facing = Math.atan2(dy, dx);
            // look-ahead target: pan camera toward the cursor (clamped)
            const la = 0.18;
            this.camTarget.x = Math.max(-140, Math.min(140, (pointer.worldX - (this.cameras.main.midPoint.x)) * la));
            this.camTarget.y = Math.max(-100, Math.min(100, (pointer.worldY - (this.cameras.main.midPoint.y)) * la));
        } else if (moving) {
            this.facing = Math.atan2(this.curVel.y, this.curVel.x);
            this.camTarget.x = 0; this.camTarget.y = 0;
        }
        // ease camera offset
        this.camOffset.x += (this.camTarget.x - this.camOffset.x) * Math.min(1, dt * 3);
        this.camOffset.y += (this.camTarget.y - this.camOffset.y) * Math.min(1, dt * 3);
        this.cameras.main.setFollowOffset(this.camOffset.x, this.camOffset.y);

        // character orientation: flip toward cursor/movement, subtle lean
        const cos = Math.cos(this.facing);
        this.player.setFlipX(cos < 0);
        this.player.rotation = Math.sin(this.facing) * 0.06 * (moving ? 1 : 0.4);

        // ---- Walk animation & footstep feedback ----
        if (moving) {
            const frame = Math.floor(time / (this.sprinting ? 90 : 140)) % 4;
            this.player.setFrame(frame);
            // footstep ticks
            if (time - this.lastStep > (this.sprinting ? 260 : 380)) {
                this.lastStep = time;
                audioEngine.dust();
            }
            // sprint dust kick-up at the feet
            if (this.sprinting && time - this.lastDust > 60) {
                this.lastDust = time;
                this.dustEmitter.x = this.player.x - Math.cos(this.facing) * 8;
                this.dustEmitter.y = this.player.y + 16;
                this.dustEmitter.emitParticle(2);
            }
        } else {
            this.player.setFrame(0);
            this.player.rotation *= 0.85;
        }

        // firefly herding puzzle logic
        if (this.activePuzzle === 'fireflies' && this.beacon.visible) {
            this.beacon.x = this.player.x; this.beacon.y = this.player.y - 10;
            for (const f of this.herdedFireflies) {
                // drift toward player (beacon)
                f.x += (this.player.x - f.x) * 0.02;
                f.y += (this.player.y - f.y) * 0.02;
                // check brazier ignition
                for (const bl of this.brazierLights) {
                    if (!bl.lit && Math.hypot(f.x - bl.brazier.x, f.y - bl.brazier.y) < 26) {
                        bl.lit = true; bl.flame.setVisible(true);
                        this.tweens.add({ targets: bl.flame, scaleY: 1.3, yoyo: true, repeat: -1, duration: 300 });
                        audioEngine.blip(660, 0.12, 0.2);
                    }
                }
            }
            if (this.brazierLights.every(b => b.lit)) this.solvePuzzle('fireflies');
        }

        // mirror beam render
        if (this.activePuzzle === 'mirrors' && this.lightBeam) {
            this.lightBeam.clear();
            this.lightBeam.lineStyle(4, COLORS.STAR, 0.9);
            let px = this.mirrors[0]?.x ?? 0, py = (this.mirrors[0]?.y ?? 0) - 20;
            this.lightBeam.beginPath(); this.lightBeam.moveTo(px, py);
            this.mirrors.forEach(m => { this.lightBeam.lineTo(m.x, m.y - 20); });
            this.lightBeam.lineTo(WORLD_W / 2, WORLD_H / 2);
            this.lightBeam.strokePath();
        }

        // proximity HUD refresh (throttled)
        if (time - this.lastHud > 200) { this.lastHud = time; this.pushHud(); }
    }
    private lastHud = 0;
}

const StartGame = (parent: string) => {
    const config: Phaser.Types.Core.GameConfig = {
        type: AUTO,
        width: GAME_WIDTH,
        height: GAME_HEIGHT,
        parent,
        backgroundColor: '#1a0f2e',
        scale: {
            mode: Scale.FIT,
            autoCenter: Scale.CENTER_BOTH,
        },
        physics: {
            default: 'arcade',
            arcade: { gravity: { x: 0, y: 0 }, debug: false },
        },
        scene: [Game],
    };
    const game = new PhaserGame(config);
    if (typeof window !== 'undefined') {
        (window as any).__PHASER_GAME__ = game;
        (window as any).__PHASER_EVENT_BUS__ = EventBus;
    }
    return game;
};

export default StartGame;
