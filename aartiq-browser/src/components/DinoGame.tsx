"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, Play, RotateCcw, Trophy } from 'lucide-react';

const DinoGame = () => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [gameOver, setGameOver] = useState(false);
    const [score, setScore] = useState(0);
    const [highScore, setHighScore] = useState(0);
    const [dinoY, setDinoY] = useState(0);
    const [obstacles, setObstacles] = useState<{ id: number; x: number; type: number }[]>([]);

    const gameContainerRef = useRef<HTMLDivElement>(null);
    const requestRef = useRef<number>(0);
    const lastTimeRef = useRef<number>(0);
    const velocityRef = useRef(0);
    const isJumpingRef = useRef(false);
    const obstacleIdRef = useRef(0);
    const scoreRef = useRef(0);

    const GRAVITY = 0.6;
    const JUMP_FORCE = -12;
    const GROUND_Y = 0;
    const SPEED = 5;

    useEffect(() => {
        const savedHS = localStorage.getItem('comet-dino-hs');
        if (savedHS) setHighScore(parseInt(savedHS));
    }, []);

    const jump = () => {
        if (!isJumpingRef.current && !gameOver) {
            velocityRef.current = JUMP_FORCE;
            isJumpingRef.current = true;
        }
    };

    const startGame = () => {
        setIsPlaying(true);
        setGameOver(false);
        setScore(0);
        scoreRef.current = 0;
        setDinoY(0);
        velocityRef.current = 0;
        isJumpingRef.current = false;
        setObstacles([]);
        lastTimeRef.current = performance.now();
        requestRef.current = requestAnimationFrame(gameLoop);
    };

    const gameLoop = (time: number) => {
        if (gameOver) return;

        const deltaTime = time - lastTimeRef.current;
        lastTimeRef.current = time;

        // Update Dino
        velocityRef.current += GRAVITY;
        setDinoY(prev => {
            const next = prev - velocityRef.current;
            if (next <= GROUND_Y) {
                isJumpingRef.current = false;
                velocityRef.current = 0;
                return GROUND_Y;
            }
            return next;
        });

        // Update Score
        scoreRef.current += 1;
        if (scoreRef.current % 10 === 0) {
            setScore(Math.floor(scoreRef.current / 10));
        }

        // Update Obstacles
        setObstacles(prev => {
            const next = prev.map(o => ({ ...o, x: o.x - SPEED })).filter(o => o.x > -50);

            // Spawn new obstacle
            if (next.length === 0 || (next[next.length - 1].x < 400 && Math.random() < 0.02)) {
                next.push({
                    id: obstacleIdRef.current++,
                    x: 800,
                    type: Math.floor(Math.random() * 3)
                });
            }

            // Collision Detection
            const dinoBox = { x: 50, y: dinoY, w: 40, h: 40 };
            for (const o of next) {
                const obsBox = { x: o.x, y: 0, w: 30, h: o.type === 0 ? 40 : 60 };
                if (
                    dinoBox.x < obsBox.x + obsBox.w &&
                    dinoBox.x + dinoBox.w > obsBox.x &&
                    dinoBox.y < obsBox.y + obsBox.h &&
                    dinoBox.y + dinoBox.h > obsBox.y
                ) {
                    setGameOver(true);
                    return next;
                }
            }

            return next;
        });

        requestRef.current = requestAnimationFrame(gameLoop);
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'Space' || e.code === 'ArrowUp') {
                e.preventDefault();
                if (!isPlaying || gameOver) startGame();
                else jump();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            cancelAnimationFrame(requestRef.current);
        };
    }, [isPlaying, gameOver, dinoY]);

    useEffect(() => {
        if (gameOver) {
            cancelAnimationFrame(requestRef.current);
            if (score > highScore) {
                setHighScore(score);
                localStorage.setItem('comet-dino-hs', score.toString());
            }
        }
    }, [gameOver]);

    return (
        <div className="flex flex-col items-center justify-center h-full bg-[#0a0a0f] text-white p-8 select-none">
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center mb-12"
            >
                <div className="inline-flex p-4 rounded-3xl bg-red-500/10 border border-red-500/20 text-red-400 mb-6">
                    <WifiOff size={48} />
                </div>
                <h2 className="text-4xl font-black uppercase tracking-tighter mb-2">Neural Link Severed</h2>
                <p className="text-white/40 font-bold uppercase tracking-widest text-xs">Offline Workspace Detected • Initializing T-Rex Simulation</p>
            </motion.div>

            <div
                ref={gameContainerRef}
                className="relative w-full max-w-4xl h-64 bg-white/[0.02] border-b-2 border-white/10 rounded-t-[3rem] overflow-hidden"
            >
                {/* Score UI */}
                <div className="absolute top-6 right-8 flex gap-8">
                    <div className="flex flex-col items-end">
                        <span className="text-[10px] font-black uppercase tracking-widest text-white/20">High Score</span>
                        <span className="text-xl font-black text-sky-400 tracking-tighter">{highScore.toString().padStart(5, '0')}</span>
                    </div>
                    <div className="flex flex-col items-end">
                        <span className="text-[10px] font-black uppercase tracking-widest text-white/20">Score</span>
                        <span className="text-xl font-black text-white tracking-tighter">{score.toString().padStart(5, '0')}</span>
                    </div>
                </div>

                {/* Ground */}
                <div className="absolute bottom-0 w-full h-px bg-white/20" />

                {/* Dino */}
                <motion.div
                    className="absolute left-[50px] bottom-0"
                    style={{ y: -dinoY }}
                >
                    <div className="w-12 h-12 relative">
                        <div className="absolute inset-0 bg-green-400 rounded-lg shadow-[0_0_20px_rgba(74,222,128,0.4)]" />
                        <div className="absolute top-2 right-2 w-2 h-2 bg-[#020205] rounded-full" />
                    </div>
                </motion.div>

                {/* Obstacles */}
                {obstacles.map(obs => (
                    <div
                        key={obs.id}
                        className="absolute bottom-0 bg-red-400/80 rounded-t-md"
                        style={{
                            left: obs.x,
                            width: 30,
                            height: obs.type === 0 ? 40 : 60,
                            boxShadow: '0 0 15px rgba(248,113,113,0.3)'
                        }}
                    />
                ))}

                {/* Controls Overlay */}
                <AnimatePresence>
                    {(!isPlaying || gameOver) && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm"
                        >
                            <div className="text-center">
                                {gameOver && (
                                    <motion.div
                                        initial={{ scale: 0.9 }}
                                        animate={{ scale: 1 }}
                                        className="mb-6 flex flex-col items-center"
                                    >
                                        <Trophy size={48} className="text-yellow-400 mb-2 drop-shadow-[0_0_15px_rgba(250,204,21,0.4)]" />
                                        <h3 className="text-2xl font-black uppercase tracking-tighter text-white">Simulation Failed</h3>
                                    </motion.div>
                                )}
                                <button
                                    onClick={startGame}
                                    className="px-10 py-4 bg-white text-black rounded-2xl font-black uppercase tracking-widest text-xs hover:scale-105 active:scale-95 transition-all flex items-center gap-3 shadow-[0_10px_30px_rgba(255,255,255,0.2)]"
                                >
                                    {gameOver ? <RotateCcw size={16} /> : <Play size={16} />}
                                    {gameOver ? 'Resume Simulation' : 'Enter Simulation'}
                                </button>
                                <p className="mt-6 text-[10px] font-bold text-white/30 uppercase tracking-[0.3em]">Press SPACE to jump</p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <div className="mt-12 flex gap-12 opacity-30">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-[10px] font-black">↑</div>
                    <span className="text-[10px] font-black uppercase tracking-widest">Jump</span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="w-16 h-8 rounded-lg bg-white/5 flex items-center justify-center text-[10px] font-black">SPACE</div>
                    <span className="text-[10px] font-black uppercase tracking-widest">Start / Jump</span>
                </div>
            </div>
        </div>
    );
};

export default DinoGame;
