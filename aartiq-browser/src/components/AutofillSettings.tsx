"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, Mail, Phone, Building, MapPin, Home, Globe, Plus, Trash2, 
  RefreshCw, PenLine, Check, X, Sparkles, Save, AlertTriangle
} from 'lucide-react';

const PROFILE_FIELDS = [
  { key: 'label', label: 'Profile Name', icon: User, required: true },
  { key: 'firstName', label: 'First Name', icon: User },
  { key: 'lastName', label: 'Last Name', icon: User },
  { key: 'email', label: 'Email', icon: Mail },
  { key: 'phone', label: 'Phone', icon: Phone },
  { key: 'organization', label: 'Organization', icon: Building },
  { key: 'addressLine1', label: 'Address Line 1', icon: MapPin },
  { key: 'addressLine2', label: 'Address Line 2', icon: Home },
  { key: 'city', label: 'City', icon: MapPin },
  { key: 'state', label: 'State', icon: MapPin },
  { key: 'postalCode', label: 'Postal Code', icon: MapPin },
  { key: 'country', label: 'Country', icon: Globe },
];

interface Profile {
  id: string;
  label: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  organization: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  createdAt?: string;
  updatedAt?: string;
}

function emptyProfile(): Record<string, string> {
  return Object.fromEntries(PROFILE_FIELDS.map(f => [f.key, '']));
}

const AutofillSettings = () => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>(emptyProfile());
  const [status, setStatus] = useState<string | null>(null);
  const [fillStatus, setFillStatus] = useState<Record<string, string>>({});

  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    try {
      const result = await (window as any).electronAPI?.autofillList();
      setProfiles(result || []);
    } catch { setProfiles([]); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchProfiles(); }, [fetchProfiles]);

  const handleNew = () => {
    setEditingId('new');
    setForm(emptyProfile());
  };

  const handleEdit = (profile: Profile) => {
    setEditingId(profile.id);
    setForm(Object.fromEntries(PROFILE_FIELDS.map(f => [f.key, (profile as any)[f.key] || ''])));
  };

  const handleCancel = () => {
    setEditingId(null);
    setForm(emptyProfile());
  };

  const handleSave = async () => {
    if (!form.label?.trim()) {
      setStatus('Profile name is required');
      return;
    }
    setStatus(null);
    try {
      if (editingId === 'new') {
        const result = await (window as any).electronAPI.autofillAdd(form);
        if (result?.success) {
          setStatus('Profile created');
          setEditingId(null);
          setForm(emptyProfile());
          fetchProfiles();
        } else setStatus(result?.error || 'Failed to create');
      } else {
        const result = await (window as any).electronAPI.autofillUpdate(editingId, form);
        if (result?.success) {
          setStatus('Profile updated');
          setEditingId(null);
          setForm(emptyProfile());
          fetchProfiles();
        } else setStatus(result?.error || 'Failed to update');
      }
    } catch (e: any) {
      setStatus(`Error: ${e.message}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this autofill profile?')) return;
    await (window as any).electronAPI.autofillDelete(id);
    fetchProfiles();
  };

  const handleFill = async (id: string) => {
    setFillStatus(prev => ({ ...prev, [id]: 'filling' }));
    const result = await (window as any).electronAPI.autofillFill(id);
    if (result?.success) {
      setFillStatus(prev => ({ ...prev, [id]: `Filled ${result.filled} field(s)` }));
    } else {
      setFillStatus(prev => ({ ...prev, [id]: result?.error || 'Failed' }));
    }
    setTimeout(() => setFillStatus(prev => { const n = { ...prev }; delete n[id]; return n; }), 3000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-white mb-1">Autofill Profiles</h3>
          <p className="text-xs text-white/30">Manage your form autofill profiles</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleNew} className="flex items-center gap-2 px-4 py-2 bg-deep-space-accent-neon/10 hover:bg-deep-space-accent-neon/20 border border-deep-space-accent-neon/20 rounded-xl text-[10px] font-black uppercase tracking-widest text-deep-space-accent-neon transition-all">
            <Plus size={12} /> New Profile
          </button>
          <button onClick={fetchProfiles} className={`p-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-white/50 transition-all ${loading ? 'animate-spin' : ''}`}>
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {status && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="p-3 rounded-2xl bg-deep-space-accent-neon/10 border border-deep-space-accent-neon/20 text-deep-space-accent-neon text-xs font-bold flex items-center gap-2">
            <Sparkles size={14} /> {status}
            <button onClick={() => setStatus(null)} className="ml-auto opacity-50 hover:opacity-100">&times;</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Form */}
      <AnimatePresence>
        {editingId && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="p-6 rounded-[2rem] bg-white/[0.02] border border-white/5 space-y-4">
              <h4 className="text-xs font-black uppercase tracking-widest text-white/40">{editingId === 'new' ? 'New Profile' : 'Edit Profile'}</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {PROFILE_FIELDS.map(field => {
                  const Icon = field.icon;
                  return (
                    <div key={field.key} className="relative">
                      <Icon size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
                      <input
                        type="text"
                        value={form[field.key] || ''}
                        onChange={e => setForm(p => ({ ...p, [field.key]: e.target.value }))}
                        placeholder={field.label + (field.required ? ' *' : '')}
                        className="w-full bg-black/40 border border-white/10 rounded-xl pl-8 pr-3 py-2 text-[12px] text-white focus:outline-none focus:border-deep-space-accent-neon/40 placeholder:text-white/20"
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={handleCancel} className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-[10px] font-bold text-white/40 transition-all flex items-center gap-1">
                  <X size={12} /> Cancel
                </button>
                <button onClick={handleSave} className="px-4 py-2 bg-deep-space-accent-neon/10 hover:bg-deep-space-accent-neon/20 border border-deep-space-accent-neon/20 rounded-xl text-[10px] font-black uppercase tracking-widest text-deep-space-accent-neon transition-all flex items-center gap-1">
                  <Save size={12} /> Save
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Profile List */}
      {loading ? (
        <div className="py-20 text-center animate-pulse">
          <User size={48} className="mx-auto mb-4 text-white/10" />
          <p className="text-xs text-white/20 uppercase tracking-widest font-black">Loading profiles...</p>
        </div>
      ) : profiles.length === 0 && !editingId ? (
        <div className="py-20 text-center bg-white/[0.01] border border-dashed border-white/5 rounded-3xl">
          <PenLine size={48} className="mx-auto mb-4 text-white/10" />
          <p className="text-sm text-white/20 font-bold">No autofill profiles</p>
          <p className="text-xs text-white/10 mt-2">Create a profile to autofill forms with one click</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          <AnimatePresence>
            {profiles.map(profile => (
              <motion.div key={profile.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }}
                className="p-5 rounded-[2rem] bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-all relative overflow-hidden group"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/20 flex items-center justify-center text-cyan-400 font-black text-sm flex-shrink-0">
                    {getInitials(profile.label)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-white tracking-tight">{profile.label}</h4>
                    {profile.email && <p className="text-xs text-white/40 mt-0.5">{profile.email}</p>}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[10px] text-white/25">
                      {profile.firstName && <span>{profile.firstName} {profile.lastName}</span>}
                      {profile.phone && <span>{profile.phone}</span>}
                      {profile.city && <span>{profile.city}, {profile.state || ''}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
                    <button onClick={() => handleFill(profile.id)}
                      className="px-3 py-2 rounded-xl bg-deep-space-accent-neon/10 border border-deep-space-accent-neon/20 text-deep-space-accent-neon text-[10px] font-bold hover:bg-deep-space-accent-neon/20 transition-all flex items-center gap-1">
                      <Sparkles size={12} /> Fill
                    </button>
                    <button onClick={() => handleEdit(profile)}
                      className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-white/30 hover:text-white/60 transition-all">
                      <PenLine size={14} />
                    </button>
                    <button onClick={() => handleDelete(profile.id)}
                      className="p-2 rounded-xl bg-red-500/5 hover:bg-red-500/15 border border-red-500/10 text-red-400/50 hover:text-red-400 transition-all">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                {fillStatus[profile.id] && (
                  <div className={`mt-3 px-3 py-2 rounded-xl text-[10px] font-bold flex items-center gap-1.5 ${fillStatus[profile.id] === 'filling' ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                    {fillStatus[profile.id] === 'filling' ? <RefreshCw size={10} className="animate-spin" /> : <Check size={10} />}
                    {fillStatus[profile.id]}
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

function getInitials(s: string): string {
  return s.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
}

export default AutofillSettings;
