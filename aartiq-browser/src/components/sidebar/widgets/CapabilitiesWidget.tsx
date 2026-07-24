"use client";

import React, { memo } from 'react';
import { Globe, Terminal, FileText, Image, Cpu, Zap } from 'lucide-react';

const capabilities = [
  { icon: <Globe size={12} />, label: 'Web Browsing', desc: 'Navigate, search, read pages' },
  { icon: <Terminal size={12} />, label: 'System Automation', desc: 'Shell, apps, OCR' },
  { icon: <FileText size={12} />, label: 'Document Gen', desc: 'PDF, DOCX, PPTX, XLSX' },
  { icon: <Image size={12} />, label: 'Image Generation', desc: 'DALL-E, Stable Diffusion' },
  { icon: <Cpu size={12} />, label: 'Scheduling', desc: 'Cron tasks, reminders' },
  { icon: <Zap size={12} />, label: 'Apple Intelligence', desc: 'Summarization, Image Playground' },
];

const CapabilitiesWidget = memo(function CapabilitiesWidget() {
  return (
    <div className="space-y-1">
      {capabilities.map((cap) => (
        <div key={cap.label} className="flex items-center gap-2 py-1">
          <span className="text-secondary-text/50 shrink-0">{cap.icon}</span>
          <span className="text-[10px] font-medium text-secondary-text/70">{cap.label}</span>
          <span className="text-[8px] text-secondary-text/40 ml-auto truncate">{cap.desc}</span>
        </div>
      ))}
    </div>
  );
});

export default memo(CapabilitiesWidget);
