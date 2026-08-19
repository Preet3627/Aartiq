import React, { useState, memo } from 'react';
import { ChevronRight, Puzzle, Search, BarChart3, DollarSign, FileText, Globe, Cog, Link2, Apple, Layers, Palette, Calendar, Shield, Settings } from 'lucide-react';
import { AVAILABLE_SKILLS } from '@/lib/SkillRegistry';

const SKILL_ICONS: Record<string, React.ReactNode> = {
  research: <Search size={13} />,
  analysis: <BarChart3 size={13} />,
  finance: <DollarSign size={13} />,
  documents: <FileText size={13} />,
  browsing: <Globe size={13} />,
  automation: <Cog size={13} />,
  mcp: <Link2 size={13} />,
  'apple-intelligence': <Apple size={13} />,
  'tab-intelligence': <Layers size={13} />,
  'image-generation': <Palette size={13} />,
  scheduling: <Calendar size={13} />,
  security: <Shield size={13} />,
  settings: <Settings size={13} />,
};

const SKILL_COLORS: Record<string, string> = {
  research: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
  analysis: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
  finance: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  documents: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  browsing: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
  automation: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  mcp: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  'apple-intelligence': 'text-pink-400 bg-pink-500/10 border-pink-500/20',
  'tab-intelligence': 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
  'image-generation': 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  scheduling: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
  security: 'text-red-400 bg-red-500/10 border-red-500/20',
  settings: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
};

const SkillsListMessage = memo(function SkillsListMessage() {
  const [open, setOpen] = useState(false);

  return (
    <div className="w-full mt-1.5 rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-[11px] hover:bg-white/[0.03] transition-colors"
      >
        <ChevronRight
          size={12}
          className={`text-white/30 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
        />
        <Puzzle size={11} className="text-violet-400" />
        <span className="text-white/50 font-medium">
          {AVAILABLE_SKILLS.length} AI skills available
        </span>
        <span className="text-white/20 text-[10px] ml-auto">
          {open ? 'Hide' : 'Show'}
        </span>
      </button>

      {open && (
        <div className="px-3 pb-3 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {AVAILABLE_SKILLS.map((skill) => (
            <div
              key={skill.id}
              className={`flex items-start gap-2 rounded-lg border px-2 py-1.5 ${
                SKILL_COLORS[skill.id] || 'text-white/50 bg-white/5 border-white/10'
              }`}
            >
              <span className="mt-0.5 flex-shrink-0">{SKILL_ICONS[skill.id] || <Puzzle size={13} />}</span>
              <div className="min-w-0">
                <div className="text-[11px] font-medium text-white/80 leading-tight">{skill.label}</div>
                <div className="text-[10px] text-white/40 leading-snug mt-0.5">{skill.description}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="px-3 pb-2.5 text-[10px] text-white/30 border-t border-white/[0.04] pt-1.5">
        Skills load automatically when relevant. Ask me to use one, or I&apos;ll pick the right one for your request.
      </div>
    </div>
  );
});

export default SkillsListMessage;
