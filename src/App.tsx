import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import StartGame, { EventBus, EVT } from './game/main';
import { audioEngine, ECHOES, type GamePhase } from './game/utils';

export interface IRefPhaserGame {
    game: Phaser.Game | null;
    scene: Phaser.Scene | null;
}

interface HudState {
    echoesRestored: number;
    totalEchoes: number;
    currentZone: string;
    promptText: string;
    rememberReady?: number;
    sprintActive?: boolean;
}

function fmtTime(s: number) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
}

function App() {
    const phaserRef = useRef<IRefPhaserGame | null>(null);

    const [phase, setPhase] = useState<GamePhase>('BOOT');
    const [hud, setHud] = useState<HudState>({ echoesRestored: 0, totalEchoes: 4, currentZone: 'The Baobab Sanctuary', promptText: '', rememberReady: 1, sprintActive: false });
    const [unlocked, setUnlocked] = useState<string[]>([]);
    const [elapsed, setElapsed] = useState(0);
    const [activePuzzle, setActivePuzzle] = useState<string | null>(null);

    const [muted, setMuted] = useState(false);
    const [sfxVol, setSfxVol] = useState(0.7);
    const [bgmVol, setBgmVol] = useState(0.5);

    const returnPhase = useRef<GamePhase>('MENU');

    // ---- Mount Phaser once ----
    useLayoutEffect(() => {
        phaserRef.current = { game: StartGame('game-container'), scene: null };
        const ready = (scene: Phaser.Scene) => { if (phaserRef.current) phaserRef.current.scene = scene; };
        EventBus.on(EVT.SCENE_READY, ready);
        return () => {
            EventBus.removeListener(EVT.SCENE_READY, ready);
            if (phaserRef.current) {
                phaserRef.current.game?.destroy(true);
                phaserRef.current = null;
            }
        };
    }, []);

    // ---- EventBus subscriptions ----
    useEffect(() => {
        const onPhase = (p: GamePhase) => setPhase(p);
        const onHud = (h: HudState) => setHud(prev => ({ ...prev, ...h }));
        const onMem = (m: { id: string; count: number }) => {
            setUnlocked(prev => (prev.includes(m.id) ? prev : [...prev, m.id]));
        };
        const onPuzzle = (s: { activePuzzle: string | null }) => setActivePuzzle(s.activePuzzle);
        EventBus.on(EVT.PHASE, onPhase);
        EventBus.on(EVT.HUD, onHud);
        EventBus.on(EVT.MEMORY, onMem);
        EventBus.on(EVT.PUZZLE, onPuzzle);
        return () => {
            EventBus.removeListener(EVT.PHASE, onPhase);
            EventBus.removeListener(EVT.HUD, onHud);
            EventBus.removeListener(EVT.MEMORY, onMem);
            EventBus.removeListener(EVT.PUZZLE, onPuzzle);
        };
    }, []);

    // ---- Menu ambience ----
    useEffect(() => {
        let stop: (() => void) | null = null;
        if (phase === 'MENU' || phase === 'BOOT') {
            stop = audioEngine.startMenuMelody();
        }
        return () => { stop?.(); };
    }, [phase]);

    // ---- Timer while playing ----
    useEffect(() => {
        if (phase !== 'PLAYING') return;
        const id = window.setInterval(() => setElapsed(e => e + 1), 1000);
        return () => window.clearInterval(id);
    }, [phase]);

    // ---- Push volumes to audio engine ----
    useEffect(() => {
        audioEngine.setVolumes(muted ? 0 : sfxVol, muted ? 0 : bgmVol);
        EventBus.emit(EVT.SOUND, { muted, sfxVol, bgmVol });
    }, [muted, sfxVol, bgmVol]);

    // ---- Keyboard: M / Tab opens memories during play ----
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.key === 'm' || e.key === 'M' || e.key === 'Tab') && phase === 'PLAYING') {
                e.preventDefault();
                returnPhase.current = 'PLAYING';
                setPhase('MEMORIES');
                EventBus.emit('toggle-pause');
            } else if (e.key === 'Escape' && (phase === 'MEMORIES' || phase === 'SETTINGS')) {
                closeOverlay();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [phase]);

    const beginJourney = useCallback(() => {
        audioEngine.blip(520);
        EventBus.emit(EVT.START);
    }, []);

    const openMemories = useCallback((from: GamePhase) => {
        audioEngine.blip(480);
        returnPhase.current = from;
        setPhase('MEMORIES');
    }, []);

    const openSettings = useCallback((from: GamePhase) => {
        audioEngine.blip(480);
        returnPhase.current = from;
        setPhase('SETTINGS');
    }, []);

    const closeOverlay = useCallback(() => {
        const back = returnPhase.current;
        setPhase(back);
        if (back === 'PLAYING') EventBus.emit('toggle-pause');
    }, []);

    const resume = useCallback(() => {
        EventBus.emit('toggle-pause'); // scene resumes & emits PLAYING
    }, []);

    const returnToMenu = useCallback(() => {
        EventBus.emit('return-menu');
        setUnlocked([]);
        setElapsed(0);
        setHud({ echoesRestored: 0, totalEchoes: 4, currentZone: 'The Baobab Sanctuary', promptText: '', rememberReady: 1, sprintActive: false });
    }, []);

    const playAgain = useCallback(() => {
        EventBus.emit('return-menu');
        setUnlocked([]);
        setElapsed(0);
        window.setTimeout(() => EventBus.emit(EVT.START), 400);
    }, []);

    const isTouch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;

    // ---- Touch joystick ----
    const joyRef = useRef<HTMLDivElement | null>(null);
    const [knob, setKnob] = useState({ x: 0, y: 0 });
    const joyActive = useRef(false);
    const startJoy = (e: React.PointerEvent) => {
        joyActive.current = true;
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        moveJoy(e);
    };
    const moveJoy = (e: React.PointerEvent) => {
        if (!joyActive.current || !joyRef.current) return;
        const r = joyRef.current.getBoundingClientRect();
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        let dx = e.clientX - cx, dy = e.clientY - cy;
        const max = r.width / 2;
        const len = Math.hypot(dx, dy) || 1;
        if (len > max) { dx = (dx / len) * max; dy = (dy / len) * max; }
        setKnob({ x: dx, y: dy });
        EventBus.emit('touch-move', { x: dx / max, y: dy / max });
    };
    const endJoy = () => {
        joyActive.current = false;
        setKnob({ x: 0, y: 0 });
        EventBus.emit('touch-move', { x: 0, y: 0 });
    };

    const echoTitle = (id: string) => ECHOES.find(e => e.id === id)?.title ?? id;

    return (
        <div id="app">
            <div id="game-container"></div>

            <div id="hud">
                {/* ============ MENU ============ */}
                {(phase === 'BOOT' || phase === 'MENU') && (
                    <div className="screen menu-screen">
                        <div className="embers" aria-hidden>
                            {Array.from({ length: 26 }).map((_, i) => (
                                <span key={i} className="ember" style={{
                                    left: `${(i * 37) % 100}%`,
                                    animationDelay: `${(i % 10) * 0.9}s`,
                                    animationDuration: `${7 + (i % 6)}s`,
                                }} />
                            ))}
                        </div>
                        <div className="baobab-silhouette" aria-hidden />
                        <div className="menu-inner">
                            <p className="eyebrow">An African Mystical Exploration</p>
                            <h1 className="title">
                                <span>ECHOES</span>
                                <em>of the</em>
                                <span>BAOBAB</span>
                            </h1>
                            <p className="tagline">Guide Kaelo the Memory Keeper through the twilight savanna and awaken the four ancestral echoes of the Great Baobab.</p>
                            <div className="menu-buttons">
                                <button className="btn btn-primary" onClick={beginJourney}>BEGIN JOURNEY</button>
                                <button className="btn" onClick={() => openMemories('MENU')}>MEMORIES</button>
                                <button className="btn" onClick={() => openSettings('MENU')}>SETTINGS</button>
                            </div>
                            <p className="hint">WASD / Arrows move · Shift sprint · E commune · R Remember · Esc pause</p>
                        </div>
                    </div>
                )}

                {/* ============ PLAYING HUD ============ */}
                {(phase === 'PLAYING' || phase === 'PAUSED' || phase === 'MEMORIES' || phase === 'SETTINGS') && (
                    <div className="hud-bar">
                        <div className="hud-left">
                            <div className="echo-pips">
                                {ECHOES.map(e => (
                                    <span key={e.id} className={`pip ${unlocked.includes(e.id) ? 'on' : ''}`} title={echoTitle(e.id)} />
                                ))}
                            </div>
                            <span className="echo-count">Echoes Restored {hud.echoesRestored}/{hud.totalEchoes}</span>
                        </div>
                        <div className="hud-center">
                            <span className="zone">{hud.currentZone}</span>
                        </div>
                        <div className="hud-right">
                            <span className="timer">⏳ {fmtTime(elapsed)}</span>
                            <button className="icon-btn" onClick={() => openMemories('PLAYING')} title="Memories">✦</button>
                            <button className="icon-btn" onClick={() => openSettings('PLAYING')} title="Settings">⚙</button>
                            <button className="icon-btn" onClick={phase === 'PAUSED' ? resume : () => EventBus.emit('toggle-pause')} title="Pause">{phase === 'PAUSED' ? '▶' : '❚❚'}</button>
                        </div>
                    </div>
                )}

                {phase === 'PLAYING' && hud.promptText && !activePuzzle && (
                    <div className="prompt-toast">{hud.promptText}</div>
                )}
                {phase === 'PLAYING' && activePuzzle && (
                    <div className="prompt-toast puzzle">{hud.promptText}</div>
                )}

                {/* ============ TOUCH CONTROLS ============ */}
                {phase === 'PLAYING' && isTouch && (
                    <>
                        <div className="joystick" ref={joyRef}
                            onPointerDown={startJoy} onPointerMove={moveJoy} onPointerUp={endJoy} onPointerCancel={endJoy}>
                            <div className="knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
                        </div>
                        <button className="action-btn" onPointerDown={() => EventBus.emit('touch-interact')}>ECHO</button>
                        <button className="action-btn remember" onPointerDown={() => EventBus.emit('touch-remember')}>R</button>
                    </>
                )}

                {/* ============ CONTROL PILLS HUD ============ */}
                {phase === 'PLAYING' && (
                    <div className="control-pills" aria-hidden>
                        <span className="pill"><b>WASD</b> Move</span>
                        <span className={`pill ${hud.sprintActive ? 'active' : ''}`}><b>Shift</b> Sprint</span>
                        <span className="pill"><b>E</b> Interact</span>
                        <span className={`pill remember ${((hud.rememberReady ?? 1) >= 1) ? 'ready' : ''}`}>
                            <b>R</b> Remember
                            {(hud.rememberReady ?? 1) < 1 && (
                                <span className="cd"><span className="cd-fill" style={{ width: `${Math.round((hud.rememberReady ?? 0) * 100)}%` }} /></span>
                            )}
                        </span>
                    </div>
                )}

                {/* ============ PAUSE ============ */}
                {phase === 'PAUSED' && (
                    <div className="screen dim-screen">
                        <div className="panel">
                            <h2>Paused</h2>
                            <p className="muted">The savanna holds its breath…</p>
                            <div className="panel-buttons">
                                <button className="btn btn-primary" onClick={resume}>RESUME</button>
                                <button className="btn" onClick={() => openSettings('PAUSED')}>SETTINGS</button>
                                <button className="btn" onClick={() => openMemories('PAUSED')}>LORE LOG</button>
                                <button className="btn btn-ghost" onClick={returnToMenu}>RETURN TO MENU</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ============ MEMORIES ============ */}
                {phase === 'MEMORIES' && (
                    <div className="screen dim-screen">
                        <div className="panel wide">
                            <h2>Ancestral Memories</h2>
                            <p className="muted">The Constellation Codex of echoes awakened.</p>
                            <div className="memory-grid">
                                {ECHOES.map(e => {
                                    const got = unlocked.includes(e.id);
                                    return (
                                        <div key={e.id} className={`memory-card ${got ? 'unlocked' : 'locked'}`}>
                                            <div className="memory-icon">{got ? e.icon === 'kalimba' ? '♪' : e.icon === 'dial' ? '☀' : e.icon === 'firefly' ? '✦' : '◇' : '?'}</div>
                                            <h3>{got ? e.title : 'Sealed Echo'}</h3>
                                            <p>{got ? e.description : 'An echo not yet awakened. Seek its shrine in the sanctuary.'}</p>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="panel-buttons">
                                <button className="btn btn-primary" onClick={closeOverlay}>CLOSE</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ============ SETTINGS ============ */}
                {phase === 'SETTINGS' && (
                    <div className="screen dim-screen">
                        <div className="panel">
                            <h2>Settings</h2>
                            <div className="setting-row">
                                <label>Ambient Music</label>
                                <input type="range" min={0} max={1} step={0.05} value={muted ? 0 : bgmVol}
                                    onChange={e => { setBgmVol(parseFloat(e.target.value)); setMuted(false); }} />
                            </div>
                            <div className="setting-row">
                                <label>Sound Effects</label>
                                <input type="range" min={0} max={1} step={0.05} value={muted ? 0 : sfxVol}
                                    onChange={e => { setSfxVol(parseFloat(e.target.value)); setMuted(false); }} />
                            </div>
                            <div className="setting-row">
                                <label>Mute All</label>
                                <button className="toggle" onClick={() => setMuted(m => !m)}>{muted ? 'ON' : 'OFF'}</button>
                            </div>
                            <div className="controls-guide">
                                <h4>Controls</h4>
                                <ul>
                                    <li><b>Move</b> WASD / Arrow Keys</li>
                                    <li><b>Sprint</b> Hold Shift (dust kick-up)</li>
                                    <li><b>Look / Aim</b> Mouse cursor (camera look-ahead)</li>
                                    <li><b>Commune / Channel</b> E · Space · Click</li>
                                    <li><b>Remember (Spirit Pulse)</b> R — reveals wisps to the nearest shrine</li>
                                    <li><b>Memories</b> M · Tab</li>
                                    <li><b>Pause</b> Esc · P</li>
                                </ul>
                            </div>
                            <div className="panel-buttons">
                                <button className="btn btn-primary" onClick={closeOverlay}>DONE</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ============ FINISHED / ASCENSION ============ */}
                {phase === 'FINISHED' && (
                    <div className="screen finish-screen">
                        <div className="embers" aria-hidden>
                            {Array.from({ length: 40 }).map((_, i) => (
                                <span key={i} className="ember gold" style={{
                                    left: `${(i * 23) % 100}%`,
                                    animationDelay: `${(i % 12) * 0.5}s`,
                                    animationDuration: `${5 + (i % 5)}s`,
                                }} />
                            ))}
                        </div>
                        <div className="panel finish">
                            <p className="eyebrow">The Convergence of Echoes</p>
                            <h1 className="title small">THE GREAT BAOBAB AWAKENS</h1>
                            <p className="tagline">Four ancestral echoes hum as one. Golden auroras crown the canopy, and the memory of the savanna is whole again. Kaelo breathes — the tree of life remembers.</p>
                            <div className="stats">
                                <div><span>{hud.echoesRestored}</span><label>Echoes Awakened</label></div>
                                <div><span>{fmtTime(elapsed)}</span><label>Journey Time</label></div>
                                <div><span>1</span><label>Sanctuary Restored</label></div>
                            </div>
                            <div className="panel-buttons">
                                <button className="btn btn-primary" onClick={playAgain}>WANDER AGAIN</button>
                                <button className="btn" onClick={returnToMenu}>RETURN TO MENU</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default App;