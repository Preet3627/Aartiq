"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, MousePointer, Sparkles, Send, Loader2, Eye, Zap, Target
} from 'lucide-react';

interface OCRResult {
    text: string;
    bbox: { x0: number; y0: number; x1: number; y1: number };
    confidence: number;
    centerX?: number;
    centerY?: number;
    role?: string;
}

interface CrossAppOCRProps {
    isActive: boolean;
    onClose: () => void;
}

const CrossAppOCR: React.FC<CrossAppOCRProps> = ({ isActive, onClose }) => {
    const [screenshot, setScreenshot] = useState<string | null>(null);
    const [ocrResults, setOcrResults] = useState<OCRResult[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [aiQuery, setAiQuery] = useState('');
    const [aiResponse, setAiResponse] = useState('');
    const [isAIThinking, setIsAIThinking] = useState(false);
    const [hoveredElement, setHoveredElement] = useState<OCRResult | null>(null);
    const [clickHistory, setClickHistory] = useState<string[]>([]);
    const [ocrProvider, setOcrProvider] = useState<string>('loading');
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (isActive) {
            captureScreen();
        }
    }, [isActive]);

    const captureScreen = async () => {
        setIsProcessing(true);

        try {
            if (window.electronAPI) {
                const result = await window.electronAPI.captureScreenRegion({
                    x: 0,
                    y: 0,
                    width: window.screen.width,
                    height: window.screen.height
                });

                if (result.success && result.image) {
                    setScreenshot(result.image);
                    await performOCR();
                }
            }
        } catch (error) {
            console.error('Screen capture error:', error);
            setAiResponse('Failed to capture screen for cross-app OCR.');
        } finally {
            setIsProcessing(false);
        }
    };

    const performOCR = async () => {
        setIsProcessing(true);

        try {
            if (!window.electronAPI?.ocrCaptureWords) {
                setAiResponse('Native OCR API is not available in this build.');
                return;
            }

            const result = await window.electronAPI.ocrCaptureWords();
            if (!result.success) {
                setAiResponse(result.error || 'Native OCR failed.');
                return;
            }

            setOcrProvider(result.provider || 'unknown');
            const results = (result.lines?.length ? result.lines : result.words || []) as OCRResult[];
            setOcrResults(results);
        } catch (error) {
            console.error('OCR error:', error);
            setAiResponse('Error analyzing the screen.');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleAIQuery = async () => {
        if (!aiQuery.trim()) return;

        setIsAIThinking(true);
        setAiResponse('');

        try {
            // Check if query is a click command
            const clickMatch = aiQuery.match(/click\s+(?:on\s+)?["']?(.+?)["']?$/i);

            if (clickMatch) {
                const targetText = clickMatch[1].toLowerCase();
                const result = await window.electronAPI.ocrClick(targetText, true);

                if (result.success) {
                    setAiResponse(`Clicked "${result.clickedText || targetText}" using ${result.method || 'native OCR'}.`);
                    setClickHistory(prev => [...prev, `Clicked: ${result.clickedText || targetText}`]);

                    if (typeof result.x === 'number' && typeof result.y === 'number') {
                        drawClickIndicator(result.x, result.y);
                    }
                } else {
                    setAiResponse(result.error || `Could not find "${targetText}" on screen.`);
                }
            } else {
                // General AI query about screen content
                setAiResponse(`Screen contains ${ocrResults.length} visible text targets via ${ocrProvider}. Top items: ${ocrResults.slice(0, 10).map(r => r.text).join(', ')}.`);
            }
        } catch (error) {
            console.error('AI query error:', error);
            setAiResponse('❌ Error processing request');
        } finally {
            setIsAIThinking(false);
        }
    };

    const performClick = async (element: OCRResult) => {
        if (!window.electronAPI) return;

        const centerX = element.centerX ?? (element.bbox.x0 + element.bbox.x1) / 2;
        const centerY = element.centerY ?? (element.bbox.y0 + element.bbox.y1) / 2;

        try {
            await window.electronAPI.performCrossAppClick({
                x: Math.round(centerX),
                y: Math.round(centerY)
            });

            // Visual feedback
            drawClickIndicator(centerX, centerY);
        } catch (error) {
            console.error('Click error:', error);
        }
    };

    const drawClickIndicator = (x: number, y: number) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Draw ripple effect
        ctx.strokeStyle = '#8b5cf6';
        ctx.lineWidth = 3;

        let radius = 0;
        const maxRadius = 50;

        const animate = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Redraw OCR boxes
            drawOCRBoxes(ctx);

            // Draw ripple
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.stroke();

            radius += 2;

            if (radius < maxRadius) {
                requestAnimationFrame(animate);
            }
        };

        animate();
    };

    const drawOCRBoxes = (ctx: CanvasRenderingContext2D) => {
        ocrResults.forEach(result => {
            ctx.strokeStyle = hoveredElement === result ? '#8b5cf6' : '#ffffff40';
            ctx.lineWidth = hoveredElement === result ? 2 : 1;
            ctx.strokeRect(
                result.bbox.x0,
                result.bbox.y0,
                result.bbox.x1 - result.bbox.x0,
                result.bbox.y1 - result.bbox.y0
            );
        });
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !screenshot) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const img = new Image();
        img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            drawOCRBoxes(ctx);
        };
        img.src = screenshot;
    }, [screenshot, ocrResults, hoveredElement]);

    if (!isActive) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[10001] bg-black/90 backdrop-blur-sm"
            >
                {/* Screenshot Preview */}
                <div className="absolute inset-0 flex items-center justify-center p-4">
                    {screenshot ? (
                        <div className="relative max-w-full max-h-full">
                            <canvas
                                ref={canvasRef}
                                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                                style={{ maxHeight: 'calc(100vh - 300px)' }}
                            />

                            {isProcessing && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
                                    <div className="text-center">
                                        <Loader2 size={48} className="text-purple-400 animate-spin mx-auto mb-2" />
                                        <p className="text-white text-sm">Analyzing screen with OCR...</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-center">
                            <Loader2 size={48} className="text-purple-400 animate-spin mx-auto mb-2" />
                            <p className="text-white">Capturing screen...</p>
                        </div>
                    )}
                </div>

                {/* AI Chat Popup */}
                <motion.div
                    initial={{ y: 100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 100, opacity: 0 }}
                    className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full max-w-2xl mx-4"
                >
                    <div className="bg-gradient-to-br from-purple-900/95 to-blue-900/95 backdrop-blur-2xl border border-white/20 rounded-2xl shadow-2xl overflow-hidden">
                        {/* Header */}
                        <div className="p-4 border-b border-white/10 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Target size={20} className="text-purple-400" />
                                <div>
                                    <h3 className="text-white font-semibold">Cross-App Control</h3>
                                    <p className="text-white/60 text-xs">
                                        {ocrResults.length} targets detected via {ocrProvider}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                            >
                                <X size={18} className="text-white/60" />
                            </button>
                        </div>

                        {/* AI Response */}
                        {aiResponse && (
                            <div className="p-4 bg-black/20 border-b border-white/10">
                                <div className="flex items-start gap-3">
                                    <Sparkles size={16} className="text-purple-400 mt-1 flex-shrink-0" />
                                    <p className="text-white/90 text-sm">{aiResponse}</p>
                                </div>
                            </div>
                        )}

                        {/* Click History */}
                        {clickHistory.length > 0 && (
                            <div className="p-3 bg-black/10 border-b border-white/10">
                                <div className="flex items-center gap-2 mb-2">
                                    <MousePointer size={14} className="text-green-400" />
                                    <span className="text-white/60 text-xs">Recent Actions:</span>
                                </div>
                                <div className="space-y-1">
                                    {clickHistory.slice(-3).map((action, index) => (
                                        <div key={index} className="text-white/70 text-xs flex items-center gap-2">
                                            <div className="w-1 h-1 rounded-full bg-green-400" />
                                            {action}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Input */}
                        <div className="p-4">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={aiQuery}
                                    onChange={(e) => setAiQuery(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAIQuery()}
                                    placeholder='Try: "Click on File" or "Click on the Close button"'
                                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-sm"
                                    disabled={isAIThinking}
                                />
                                <button
                                    onClick={handleAIQuery}
                                    disabled={isAIThinking || !aiQuery.trim()}
                                    className="px-6 py-3 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-white font-medium transition-all flex items-center gap-2"
                                >
                                    {isAIThinking ? (
                                        <Loader2 size={18} className="animate-spin" />
                                    ) : (
                                        <Send size={18} />
                                    )}
                                </button>
                            </div>

                            {/* Quick Actions */}
                            <div className="mt-3 flex flex-wrap gap-2">
                                <button
                                    onClick={() => setAiQuery('Click on File')}
                                    className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-white/70 text-xs transition-all"
                                >
                                    Click on File
                                </button>
                                <button
                                    onClick={() => setAiQuery('Click on Close')}
                                    className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-white/70 text-xs transition-all"
                                >
                                    Click on Close
                                </button>
                                <button
                                    onClick={captureScreen}
                                    className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-white/70 text-xs transition-all flex items-center gap-1"
                                >
                                    <Eye size={12} />
                                    Refresh
                                </button>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Instructions */}
                <div className="absolute top-6 left-1/2 -translate-x-1/2">
                    <motion.div
                        initial={{ y: -20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        className="bg-black/60 backdrop-blur-xl border border-white/20 rounded-full px-6 py-3"
                    >
                        <p className="text-white/80 text-sm flex items-center gap-2">
                            <Zap size={16} className="text-yellow-400" />
                            AI can click on any visible element across all applications
                        </p>
                    </motion.div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
};

export default CrossAppOCR;
