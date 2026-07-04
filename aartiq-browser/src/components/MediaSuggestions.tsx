"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Search, Image as ImageIcon, Plus } from 'lucide-react';

const MediaSuggestions = ({ onSelect }: { onSelect: (url: string) => void }) => {
    // Mock image results based on active context
    const images = [
        "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=200&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=200&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=200&auto=format&fit=crop"
    ];

    return (
        <div className="p-4 bg-white/5 border border-white/5 rounded-2xl space-y-3">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-white/30">
                <div className="flex items-center gap-2">
                    <ImageIcon size={12} />
                    <span>Visual Assets</span>
                </div>
                <button className="hover:text-white"><Search size={10} /></button>
            </div>
            <div className="grid grid-cols-3 gap-2">
                {images.map((img, i) => (
                    <motion.div
                        key={i}
                        whileHover={{ scale: 1.05 }}
                        className="relative group cursor-pointer"
                        onClick={() => onSelect(img)}
                    >
                        <img src={img} className="w-full aspect-square object-cover rounded-lg border border-white/10" alt="suggested" />
                        <div className="absolute inset-0 bg-deep-space-accent-neon/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-lg">
                            <Plus size={16} className="text-white" />
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
};

export default MediaSuggestions;
