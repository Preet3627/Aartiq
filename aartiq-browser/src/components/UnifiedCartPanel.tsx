import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, X, ScanLine } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

const UnifiedCartPanel = ({ onClose, onScan }: { onClose: () => void, onScan: () => void }) => {
    const store = useAppStore();

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className={`absolute top-20 ${store.sidebarSide === 'right' && store.sidebarOpen ? 'right-[290px]' : 'right-4'} w-96 glass-vibrant z-[1000] rounded-[2rem] p-8 shadow-3xl bg-black/40 border border-white/10`}
        >
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h3 className="text-xl font-black uppercase tracking-tighter text-white">Unified Cart</h3>
                    <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest">Cross-Site AI Manager</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={onScan} className="p-3 bg-deep-space-accent-neon/10 text-deep-space-accent-neon rounded-2xl hover:bg-deep-space-accent-neon/20 transition-all" title="Scan Page for Products">
                        <ScanLine size={18} />
                    </button>
                    <button onClick={onClose} className="p-3 text-white/40 hover:text-white transition-all">
                        <X size={18} />
                    </button>
                </div>
            </div>

            <div className="space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                {store.unifiedCart.length === 0 ? (
                    <div className="py-12 text-center">
                        <ShoppingCart size={40} className="mx-auto text-white/10 mb-4" />
                        <p className="text-white/30 text-xs">No items detected by BrowserAI yet.</p>
                    </div>
                ) : (
                    store.unifiedCart.map((item) => (
                        <div key={item.id} className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex gap-4 group">
                            <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-lg">🛍️</div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-white truncate">{item.item}</p>
                                <p className="text-xs text-white/40 uppercase tracking-widest">{item.site}</p>
                                <p className="text-deep-space-accent-neon font-black mt-1">{item.price}</p>
                            </div>
                            <button
                                onClick={() => store.removeFromCart(item.id)}
                                className="opacity-0 group-hover:opacity-100 p-2 text-white/20 hover:text-red-400 transition-all"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    ))
                )}
            </div>

            {store.unifiedCart.length > 0 && (
                <button className="w-full mt-8 py-4 bg-deep-space-accent-neon text-deep-space-bg font-black rounded-2xl text-[10px] uppercase tracking-widest shadow-[0_0_20px_rgba(0,255,255,0.3)] hover:scale-[1.02] transition-all">
                    Checkout All via Comet Pay
                </button>
            )}
        </motion.div>
    );
};

export default UnifiedCartPanel;
