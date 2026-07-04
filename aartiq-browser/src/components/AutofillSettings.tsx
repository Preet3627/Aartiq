"use client";

import { useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { Plus, X, CreditCard, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const AutofillSettings = () => {
    const store = useAppStore();
    const [activeTab, setActiveTab] = useState<'addresses' | 'payments'>('addresses');
    const [showAdd, setShowAdd] = useState(false);

    // Form States
    const [newAddr, setNewAddr] = useState({ name: '', address: '', street: '', city: '', zip: '', country: '' });
    const [newCard, setNewCard] = useState({ name: '', cardNumber: '', expiry: '', cvc: '' });

    const handleSave = () => {
        if (activeTab === 'addresses') {
            if (newAddr.name) store.addAddress({ ...newAddr, address: newAddr.street });
            setNewAddr({ name: '', address: '', street: '', city: '', zip: '', country: '' });
        } else {
            if (newCard.cardNumber) store.addPaymentMethod(newCard);
            setNewCard({ name: '', cardNumber: '', expiry: '', cvc: '' });
        }
        setShowAdd(false);
    };

    return (
        <div className="space-y-6">
            <div className="flex gap-4 border-b border-white/5 pb-4">
                <button onClick={() => setActiveTab('addresses')} className={`pb-2 px-2 text-sm font-bold ${activeTab === 'addresses' ? 'text-deep-space-accent-neon border-b-2 border-deep-space-accent-neon' : 'text-white/40'}`}>
                    Addresses
                </button>
                <button onClick={() => setActiveTab('payments')} className={`pb-2 px-2 text-sm font-bold ${activeTab === 'payments' ? 'text-deep-space-accent-neon border-b-2 border-deep-space-accent-neon' : 'text-white/40'}`}>
                    Payment Methods
                </button>
            </div>

            <div className="flex justify-between items-center">
                <h3 className="text-xs font-black text-white/20 uppercase tracking-[0.3em]">Saved {activeTab}</h3>
                <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                    <Plus size={14} /> Add New
                </button>
            </div>

            <AnimatePresence>
                {showAdd && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="bg-black/40 border border-white/10 rounded-2xl p-6 overflow-hidden">
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            {activeTab === 'addresses' ? (
                                <>
                                    <input placeholder="Full Name" className="bg-white/5 rounded-lg px-4 py-2 text-xs text-white border border-white/5" value={newAddr.name} onChange={e => setNewAddr({ ...newAddr, name: e.target.value })} />
                                    <input placeholder="Street Address" className="bg-white/5 rounded-lg px-4 py-2 text-xs text-white border border-white/5" value={newAddr.street} onChange={e => setNewAddr({ ...newAddr, street: e.target.value })} />
                                    <input placeholder="City" className="bg-white/5 rounded-lg px-4 py-2 text-xs text-white border border-white/5" value={newAddr.city} onChange={e => setNewAddr({ ...newAddr, city: e.target.value })} />
                                    <div className="flex gap-2">
                                        <input placeholder="ZIP" className="w-1/2 bg-white/5 rounded-lg px-4 py-2 text-xs text-white border border-white/5" value={newAddr.zip} onChange={e => setNewAddr({ ...newAddr, zip: e.target.value })} />
                                        <input placeholder="Country" className="w-1/2 bg-white/5 rounded-lg px-4 py-2 text-xs text-white border border-white/5" value={newAddr.country} onChange={e => setNewAddr({ ...newAddr, country: e.target.value })} />
                                    </div>
                                </>
                            ) : (
                                <>
                                    <input placeholder="Cardholder Name" className="bg-white/5 rounded-lg px-4 py-2 text-xs text-white border border-white/5" value={newCard.name} onChange={e => setNewCard({ ...newCard, name: e.target.value })} />
                                    <input placeholder="Card Number" className="bg-white/5 rounded-lg px-4 py-2 text-xs text-white border border-white/5" value={newCard.cardNumber} onChange={e => setNewCard({ ...newCard, cardNumber: e.target.value })} />
                                    <div className="flex gap-2">
                                        <input placeholder="MM/YY" className="bg-white/5 rounded-lg px-4 py-2 text-xs text-white border border-white/5" value={newCard.expiry} onChange={e => setNewCard({ ...newCard, expiry: e.target.value })} />
                                        <input placeholder="CVC" className="bg-white/5 rounded-lg px-4 py-2 text-xs text-white border border-white/5" value={newCard.cvc} onChange={e => setNewCard({ ...newCard, cvc: e.target.value })} />
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-[10px] font-bold uppercase text-white/40">Cancel</button>
                            <button onClick={handleSave} className="px-4 py-2 bg-deep-space-accent-neon text-deep-space-bg rounded-lg text-[10px] font-black uppercase tracking-widest">Save</button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="space-y-2">
                {activeTab === 'addresses' ? (
                    store.addresses.length === 0 ? <p className="text-center text-xs text-white/20 py-8">No addresses saved.</p> :
                        store.addresses.map(addr => (
                            <div key={addr.id} className="p-4 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between group">
                                <div className="flex items-center gap-4">
                                    <MapPin className="text-white/40" size={18} />
                                    <div>
                                        <p className="text-sm font-bold text-white">{addr.name}</p>
                                        <p className="text-xs text-white/40">{addr.street}, {addr.city}</p>
                                    </div>
                                </div>
                                <button onClick={() => store.removeAddress(addr.id)} className="p-2 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all"><X size={16} /></button>
                            </div>
                        ))
                ) : (
                    store.paymentMethods.length === 0 ? <p className="text-center text-xs text-white/20 py-8">No payment methods saved.</p> :
                        store.paymentMethods.map(pm => (
                            <div key={pm.id} className="p-4 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between group">
                                <div className="flex items-center gap-4">
                                    <CreditCard className="text-white/40" size={18} />
                                    <div>
                                        <p className="text-sm font-bold text-white">{pm.name}</p>
                                        <p className="text-xs text-white/40">**** **** **** {pm.cardNumber.slice(-4)}</p>
                                    </div>
                                </div>
                                <button onClick={() => store.removePaymentMethod(pm.id)} className="p-2 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all"><X size={16} /></button>
                            </div>
                        ))
                )}
            </div>
        </div>
    );
};

export default AutofillSettings;
