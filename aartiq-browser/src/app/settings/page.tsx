// Browser-AI/aartiq-browser/src/app/settings/page.tsx
"use client";

import SettingsPanel from '@/components/SettingsPanel';

export default function SettingsPage() {
  const handleClose = () => {
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      (window as any).electronAPI.closeWindow();
    } else if (typeof window !== 'undefined') {
      window.history.back();
    }
  };

  return (
    <SettingsPanel onClose={handleClose} />
  );
}