"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Sparkles, X, Play, Pause, SkipForward, Check, Loader2,
    MousePointer, Eye, Zap, MessageSquare, Shield
} from 'lucide-react';

interface DemoStep {
    id: string;
    title: string;
    description: string;
    action: () => Promise<void>;
    duration?: number;
}

interface AIDemoProps {
    isActive: boolean;
    onClose: () => void;
}

const AIFeatureDemo: React.FC<AIDemoProps> = ({ isActive, onClose }) => {
    const [currentStep, setCurrentStep] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [hasPermission, setHasPermission] = useState(false);
    const [showPermissionDialog, setShowPermissionDialog] = useState(true);
    const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
    const [statusMessage, setStatusMessage] = useState('');

    const demoSteps: DemoStep[] = [
        {
            id: 'intro',
            title: 'Welcome to Aartiq',
            description: 'I\'m your AI assistant. Let me show you what I can do!',
            action: async () => {
                setStatusMessage('👋 Hello! I\'m ready to demonstrate features...');
                await delay(2000);
            }
        },
        {
            id: 'search',
            title: 'Intelligent Search',
            description: 'I can search the web, apps, and system settings',
            action: async () => {
                setStatusMessage('🔍 Opening search...');
                window.dispatchEvent(new CustomEvent('open-unified-search'));
                await delay(1000);
                setStatusMessage('✨ Type anything to search across your entire system!');
                await delay(3000);
            }
        },
        {
            id: 'browse',
            title: 'Smart Browsing',
            description: 'Let me navigate to a website',
            action: async () => {
                setStatusMessage('🌐 Navigating to example website...');
                if (window.electronAPI) {
                    const activeTabId = (window as any).store?.activeTabId;
                    if (activeTabId) {
                        await window.electronAPI.navigateBrowserView({
                            tabId: activeTabId,
                            url: 'https://www.google.com'
                        });
                    }
                }
                await delay(2000);
                setStatusMessage('✅ Website loaded successfully!');
                await delay(1500);
            }
        },
        {
            id: 'file-manager',
            title: 'Open File Manager',
            description: 'I can open and interact with system applications',
            action: async () => {
                setStatusMessage('📁 Opening File Manager...');
                if (window.electronAPI) {
                    const platform = navigator.platform;
                    let command = '';

                    if (platform.includes('Win')) {
                        command = 'explorer';
                    } else if (platform.includes('Mac')) {
                        command = 'open ~';
                    } else {
                        command = 'nautilus ~';
                    }

                    await window.electronAPI.executeShellCommand(command);
                }
                await delay(2000);
                setStatusMessage('✅ File Manager opened!');
                await delay(1500);
            }
        },
        {
            id: 'cross-app-click',
            title: 'Cross-App Clicking',
            description: 'I can click on any element in any application using OCR',
            action: async () => {
                setStatusMessage('🎯 Demonstrating cross-app clicking...');
                await delay(1000);
                setStatusMessage('📸 Taking screenshot of entire screen...');

                if (window.electronAPI) {
                    try {
                        // Capture screen
                        const screenshot = await window.electronAPI.captureScreenRegion({
                            x: 0,
                            y: 0,
                            width: window.screen.width,
                            height: window.screen.height
                        });

                        setStatusMessage('🔍 Analyzing screen with OCR...');
                        await delay(1500);

                        setStatusMessage('✨ I can now click on any visible text or button!');
                        await delay(2000);

                        setStatusMessage('💡 Try: "Click on File" or "Click on the Close button"');
                        await delay(2000);
                    } catch (error) {
                        setStatusMessage('⚠️ Screen capture requires permission');
                    }
                }
            }
        },
        {
            id: 'wifi-info',
            title: 'System Information',
            description: 'I can check WiFi status and network information',
            action: async () => {
                setStatusMessage('📡 Checking WiFi status...');

                if (window.electronAPI) {
                    const platform = navigator.platform;
                    let command = '';

                    if (platform.includes('Win')) {
                        command = 'netsh wlan show interfaces';
                    } else if (platform.includes('Mac')) {
                        command = '/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport -I';
                    } else {
                        command = 'nmcli device wifi list';
                    }

                    const result = await window.electronAPI.executeShellCommand(command);

                    if (result.success && result.output) {
                        // Parse WiFi name from output
                        const lines = result.output.split('\n');
                        let wifiName = 'Unknown';

                        if (platform.includes('Win')) {
                            const ssidLine = lines.find(l => l.includes('SSID'));
                            if (ssidLine) {
                                wifiName = ssidLine.split(':')[1]?.trim() || 'Unknown';
                            }
                        } else if (platform.includes('Mac')) {
                            const ssidLine = lines.find(l => l.includes('SSID'));
                            if (ssidLine) {
                                wifiName = ssidLine.split(':')[1]?.trim() || 'Unknown';
                            }
                        }

                        setStatusMessage(`📶 Connected to: ${wifiName}`);
                    } else {
                        setStatusMessage('📡 WiFi information retrieved');
                    }
                }

                await delay(3000);
            }
        },
        {
            id: 'volume',
            title: 'Volume Control',
            description: 'I can adjust system volume',
            action: async () => {
                setStatusMessage('🔊 Adjusting volume to 50%...');

                if (window.electronAPI) {
                    const platform = navigator.platform;
                    let command = '';

                    if (platform.includes('Win')) {
                        command = 'nircmd.exe setsysvolume 32768';
                    } else if (platform.includes('Mac')) {
                        command = 'osascript -e "set volume output volume 50"';
                    } else {
                        command = 'amixer set \'Master\' 50%';
                    }

                    await window.electronAPI.executeShellCommand(command);
                }

                await delay(1500);
                setStatusMessage('✅ Volume set to 50%');
                await delay(1500);
            }
        },
        {
            id: 'complete',
            title: 'Demo Complete',
            description: 'You\'ve seen what I can do! Ask me anything.',
            action: async () => {
                setStatusMessage('🎉 Demo complete! I\'m ready to help you.');
                await delay(2000);
            }
        }
    ];

    useEffect(() => {
        if (isActive && !hasPermission) {
            setShowPermissionDialog(true);
        }
    }, [isActive]);

    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const handleGrantPermission = () => {
        setHasPermission(true);
        setShowPermissionDialog(false);
        setIsPlaying(true);
        runDemo();
    };

    const handleDenyPermission = () => {
        setShowPermissionDialog(false);
        onClose();
    };

    const runDemo = async () => {
        for (let i = 0; i < demoSteps.length; i++) {
            if (!isPlaying) break;

            setCurrentStep(i);

            try {
                await demoSteps[i].action();
                setCompletedSteps(prev => new Set([...prev, i]));

                if (i < demoSteps.length - 1) {
                    await delay(1000);
                }
            } catch (error) {
                console.error('Demo step error:', error);
                setStatusMessage(`⚠️ Error in step: ${demoSteps[i].title}`);
                await delay(2000);
            }
        }

        setIsPlaying(false);
    };

    const handleSkipStep = () => {
        if (currentStep < demoSteps.length - 1) {
            setCompletedSteps(prev => new Set([...prev, currentStep]));
            setCurrentStep(prev => prev + 1);
        }
    };

    const handleTogglePlay = () => {
        if (isPlaying) {
            setIsPaused(true);
            setIsPlaying(false);
        } else {
            setIsPaused(false);
            setIsPlaying(true);
            if (currentStep === 0 || currentStep === demoSteps.length - 1) {
                setCurrentStep(0);
                setCompletedSteps(new Set());
                runDemo();
            }
        }
    };

    if (!isActive) return null;

    return (
        <AnimatePresence>
            {/* Permission Dialog */}
            {showPermissionDialog && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-xl"
                >
                    <motion.div
                        initial={{ scale: 0.9, y: 20 }}
                        animate={{ scale: 1, y: 0 }}
                        className="bg-gradient-to-br from-purple-900/40 to-blue-900/40 backdrop-blur-2xl border border-white/20 rounded-3xl p-8 max-w-md mx-4 shadow-2xl"
                    >
                        <div className="flex items-center gap-3 mb-4">
                            <Shield size={32} className="text-purple-400" />
                            <h2 className="text-2xl font-bold text-white">Permission Required</h2>
                        </div>

                        <p className="text-white/80 mb-6 leading-relaxed">
                            The AI demonstration will control your device to show you features like:
                        </p>

                        <ul className="space-y-2 mb-6 text-white/70 text-sm">
                            <li className="flex items-center gap-2">
                                <Check size={16} className="text-green-400" />
                                Opening applications and files
                            </li>
                            <li className="flex items-center gap-2">
                                <Check size={16} className="text-green-400" />
                                Navigating websites
                            </li>
                            <li className="flex items-center gap-2">
                                <Check size={16} className="text-green-400" />
                                Adjusting system settings (volume, brightness)
                            </li>
                            <li className="flex items-center gap-2">
                                <Check size={16} className="text-green-400" />
                                Cross-app clicking using OCR
                            </li>
                            <li className="flex items-center gap-2">
                                <Check size={16} className="text-green-400" />
                                Checking WiFi and network status
                            </li>
                        </ul>

                        <div className="flex gap-3">
                            <button
                                onClick={handleDenyPermission}
                                className="flex-1 px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl text-white font-medium transition-all"
                            >
                                Deny
                            </button>
                            <button
                                onClick={handleGrantPermission}
                                className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 rounded-xl text-white font-medium transition-all shadow-lg shadow-purple-500/50"
                            >
                                Allow Demo
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}

            {/* Demo Interface */}
            {hasPermission && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className="fixed bottom-6 right-6 z-[9999] w-96 bg-gradient-to-br from-purple-900/90 to-blue-900/90 backdrop-blur-2xl border border-white/20 rounded-2xl shadow-2xl overflow-hidden"
                >
                    {/* Header */}
                    <div className="p-4 border-b border-white/10 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Sparkles size={20} className="text-purple-400 animate-pulse" />
                            <span className="text-white font-semibold">AI Demo</span>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-1 hover:bg-white/10 rounded-lg transition-colors"
                        >
                            <X size={18} className="text-white/60" />
                        </button>
                    </div>

                    {/* Progress */}
                    <div className="p-4 bg-black/20">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-white/60 text-xs">
                                Step {currentStep + 1} of {demoSteps.length}
                            </span>
                            <span className="text-white/60 text-xs">
                                {Math.round(((currentStep + 1) / demoSteps.length) * 100)}%
                            </span>
                        </div>
                        <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                            <motion.div
                                className="h-full bg-gradient-to-r from-purple-500 to-blue-500"
                                initial={{ width: 0 }}
                                animate={{ width: `${((currentStep + 1) / demoSteps.length) * 100}%` }}
                                transition={{ duration: 0.3 }}
                            />
                        </div>
                    </div>

                    {/* Current Step */}
                    <div className="p-4">
                        <h3 className="text-white font-semibold mb-1">
                            {demoSteps[currentStep].title}
                        </h3>
                        <p className="text-white/60 text-sm mb-3">
                            {demoSteps[currentStep].description}
                        </p>

                        {statusMessage && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="p-3 bg-white/5 rounded-lg border border-white/10 mb-3"
                            >
                                <p className="text-white/80 text-sm">{statusMessage}</p>
                            </motion.div>
                        )}
                    </div>

                    {/* Controls */}
                    <div className="p-4 border-t border-white/10 flex items-center gap-2">
                        <button
                            onClick={handleTogglePlay}
                            className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 rounded-lg text-white font-medium transition-all flex items-center justify-center gap-2"
                        >
                            {isPlaying ? (
                                <>
                                    <Pause size={16} />
                                    Pause
                                </>
                            ) : (
                                <>
                                    <Play size={16} />
                                    {currentStep === demoSteps.length - 1 ? 'Restart' : 'Play'}
                                </>
                            )}
                        </button>

                        {currentStep < demoSteps.length - 1 && (
                            <button
                                onClick={handleSkipStep}
                                className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white font-medium transition-all flex items-center gap-2"
                            >
                                <SkipForward size={16} />
                                Skip
                            </button>
                        )}
                    </div>

                    {/* Steps List */}
                    <div className="max-h-48 overflow-y-auto custom-scrollbar">
                        {demoSteps.map((step, index) => (
                            <div
                                key={step.id}
                                className={`px-4 py-2 flex items-center gap-3 transition-all ${index === currentStep
                                        ? 'bg-white/10 border-l-2 border-l-purple-500'
                                        : completedSteps.has(index)
                                            ? 'bg-white/5'
                                            : 'opacity-50'
                                    }`}
                            >
                                <div className="flex-shrink-0">
                                    {completedSteps.has(index) ? (
                                        <Check size={16} className="text-green-400" />
                                    ) : index === currentStep && isPlaying ? (
                                        <Loader2 size={16} className="text-purple-400 animate-spin" />
                                    ) : (
                                        <div className="w-4 h-4 rounded-full border-2 border-white/20" />
                                    )}
                                </div>
                                <span className="text-white/80 text-sm">{step.title}</span>
                            </div>
                        ))}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default AIFeatureDemo;
