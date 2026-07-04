import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

interface UIState {
  gradientPreset: 'graphite' | 'crystal' | 'obsidian' | 'azure' | 'rose' | 'aurora' | 'nebula' | 'liquidGlass' | 'translucent';
  setGradientPreset: (preset: 'graphite' | 'crystal' | 'obsidian' | 'azure' | 'rose' | 'aurora' | 'nebula' | 'liquidGlass' | 'translucent') => void;
}

export const useUIStore = create<UIState>()(
  devtools(
    persist(
      (set) => ({
        gradientPreset: 'graphite',
        setGradientPreset: (preset) => set({ gradientPreset: preset }),
      }),
      {
        name: 'comet-ui-store',
      }
    )
  )
);

export function useGradientTheme() {
  const gradientPreset = useUIStore((state) => state.gradientPreset);
  return gradientPreset;
}