"use client";

import { useEffect, useState } from 'react';

export function useActiveTabDwell(activeTabId?: string): number {
  const [dwellSeconds, setDwellSeconds] = useState(0);

  useEffect(() => {
    setDwellSeconds(0);
    if (!activeTabId) return;
    const started = Date.now();
    const id = window.setInterval(() => {
      setDwellSeconds(Math.floor((Date.now() - started) / 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, [activeTabId]);

  return dwellSeconds;
}
