import React, { useState, memo } from 'react';
import { ChevronRight, Puzzle, Brain, FileText, Globe, Shield, Terminal, Calendar, Image, Link } from 'lucide-react';

interface CollapsibleSkillMessageProps {
  skills: string[];
}

const SKILL_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  documents:          { icon: <FileText size={11} />,   color: 'text-amber-400',  label: 'Documents' },
  research:           { icon: <Globe size={11} />,     color: 'text-sky-400',    label: 'Research' },
  browsing:           { icon: <Globe size={11} />,     color: 'text-cyan-400',   label: 'Browsing' },
  automation:         { icon: <Terminal size={11} />,  color: 'text-emerald-400', label: 'Automation' },
  mcp:                { icon: <Link size={11} />,      color: 'text-purple-400', label: 'MCP' },
  'apple-intelligence': { icon: <Brain size={11} />,   color: 'text-pink-400',   label: 'Apple Intelligence' },
  'image-generation': { icon: <Image size={11} />,     color: 'text-orange-400', label: 'Image Generation' },
  scheduling:         { icon: <Calendar size={11} />,  color: 'text-indigo-400', label: 'Scheduling' },
  security:           { icon: <Shield size={11} />,    color: 'text-red-400',    label: 'Security' },
};

const CollapsibleSkillMessage = memo(function CollapsibleSkillMessage({
  skills,
}: CollapsibleSkillMessageProps) {
  const [open, setOpen] = useState(false);

  if (!skills || skills.length === 0) return null;

  return (
    <div className="w-full mt-1 rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
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
          {skills.length} skill{skills.length > 1 ? 's' : ''} loaded
        </span>
        {!open && (
          <span className="text-white/20 truncate ml-1 flex-1 text-left">
            {skills.map(s => SKILL_CONFIG[s]?.label || s).join(', ')}
          </span>
        )}
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-1">
          {skills.map(skillId => {
            const config = SKILL_CONFIG[skillId] || {
              icon: <Puzzle size={11} />,
              color: 'text-white/40',
              label: skillId,
            };
            return (
              <div
                key={skillId}
                className="flex items-center gap-2 px-2 py-1 rounded-lg bg-white/[0.02]"
              >
                <span className={config.color}>{config.icon}</span>
                <span className="text-[11px] text-white/50">{config.label}</span>
                <span className="text-[10px] text-white/20 ml-auto">{skillId}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

export default CollapsibleSkillMessage;
