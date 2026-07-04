"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { useAppStore } from '@/store/useAppStore';
import { motion } from 'framer-motion';
import { Users, Clock, Activity, ShieldCheck, Mail, User as UserIcon, LogOut, ChevronRight, Zap } from 'lucide-react';

const AdminDashboard = () => {
    const store = useAppStore();
    const [currentTime, setCurrentTime] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);

    const formatDuration = (ms: number) => {
        if (!ms) return "0s";
        const seconds = Math.floor((ms / 1000) % 60);
        const minutes = Math.floor((ms / (1000 * 60)) % 60);
        const hours = Math.floor(ms / (1000 * 60 * 60));

        const parts = [];
        if (hours > 0) parts.push(`${hours}h`);
        if (minutes > 0) parts.push(`${minutes}m`);
        parts.push(`${seconds}s`);
        return parts.join(" ");
    };

    // Simulated other users if we were in a multi-user environment
    const users = [
        {
            email: store.user?.email || "unknown@user.com",
            name: store.user?.displayName || "Current User",
            photoURL: store.user?.photoURL || null,
            activeTime: (store.user?.activeTime || 0) + (store.activeStartTime ? (currentTime - store.activeStartTime) : 0),
            status: 'online',
            role: 'Admin'
        },
        {
            email: "beta.tester@comet.io",
            name: "Beta Tester",
            photoURL: null,
            activeTime: 4500000,
            status: 'offline',
            role: 'User'
        },
        {
            email: "dev@ponsrischool.in",
            name: "Dev Node",
            photoURL: null,
            activeTime: 12000000,
            status: 'away',
            role: 'User'
        }
    ];

    return (
        <div className="space-y-8">
            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                    { label: "Total Active Users", val: "3", sub: "+1 this hour", icon: <Users className="text-deep-space-accent-neon" size={20} /> },
                    { label: "Session Duration (Avg)", val: "42m", sub: "Global Average", icon: <Clock className="text-purple-400" size={20} /> },
                    { label: "System Health", val: "Optimal", sub: "99.9% Uptime", icon: <Activity className="text-green-400" size={20} /> },
                ].map((s, i) => (
                    <div key={i} className="p-6 rounded-3xl bg-white/[0.03] border border-white/5 space-y-4">
                        <div className="flex items-center justify-between">
                            <p className="text-[10px] font-black uppercase tracking-widest text-white/40">{s.label}</p>
                            {s.icon}
                        </div>
                        <div>
                            <h3 className="text-3xl font-black text-white">{s.val}</h3>
                            <p className="text-[10px] font-bold text-white/20 uppercase mt-1">{s.sub}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* User Directory */}
            <div className="p-8 rounded-[2.5rem] bg-white/[0.02] border border-white/5">
                <div className="flex items-center justify-between mb-8">
                    <h3 className="text-xs font-black text-white uppercase tracking-[0.3em]">User Management Console</h3>
                    <div className="px-4 py-1.5 rounded-full bg-deep-space-accent-neon/10 border border-deep-space-accent-neon/20 flex items-center gap-2">
                        <ShieldCheck size={12} className="text-deep-space-accent-neon" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-deep-space-accent-neon">Root Privilege</span>
                    </div>
                </div>

                <div className="space-y-4">
                    {users.map((u, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.1 }}
                            className="p-4 rounded-3xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.05] transition-all flex items-center justify-between group"
                        >
                            <div className="flex items-center gap-4">
                                <div className="relative">
                                    {u.photoURL ? (
                                        <Image src={u.photoURL} alt={u.name} width={48} height={48} className="w-12 h-12 rounded-2xl border border-white/10" />
                                    ) : (
                                        <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-white/20">
                                            <UserIcon size={20} />
                                        </div>
                                    )}
                                    <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-deep-space-bg ${u.status === 'online' ? 'bg-green-500' : u.status === 'away' ? 'bg-yellow-500' : 'bg-white/20'}`} />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <p className="font-bold text-white text-sm">{u.name}</p>
                                        <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${u.role === 'Admin' ? 'bg-deep-space-accent-neon text-black' : 'bg-white/5 text-white/40'}`}>
                                            {u.role}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                        <Mail size={10} className="text-white/20" />
                                        <p className="text-[10px] text-white/40 font-medium">{u.email}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-8">
                                <div className="text-right hidden sm:block">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-white/20 mb-1">Active Time</p>
                                    <p className="text-xs font-mono text-white/60">{formatDuration(u.activeTime)}</p>
                                </div>
                                <div className="w-[1px] h-8 bg-white/5 hidden sm:block" />
                                <button title="View user details" className="p-3 rounded-2xl bg-white/5 text-white/20 hover:text-white hover:bg-white/10 transition-all opacity-0 group-hover:opacity-100">
                                    <ChevronRight size={18} />
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* Performance Metrics */}
            <div className="p-8 rounded-[2.5rem] bg-vibrant-mesh border border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-6">
                    <div className="w-16 h-16 rounded-[2rem] bg-white/10 flex items-center justify-center text-white backdrop-blur-xl">
                        <Zap size={32} />
                    </div>
                    <div>
                        <h4 className="text-2xl font-black text-white italic">Neural Sync Core v4</h4>
                        <p className="text-xs text-white/60 font-medium uppercase tracking-widest mt-1">Global Context Propagation Status: Synchronized</p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-4xl font-black text-white">9ms</p>
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Latency Spike (Max)</p>
                </div>
            </div>

            <div className="flex justify-end gap-4 mt-8">
                <button
                    onClick={() => store.logout()}
                    className="px-8 py-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all flex items-center gap-2"
                >
                    <LogOut size={14} /> Force System Logout
                </button>
            </div>
        </div>
    );
};

export default AdminDashboard;
