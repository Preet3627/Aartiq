import React, { useEffect, useRef, useState } from 'react';

interface MoleculeRendererProps {
  smiles: string;
  width?: number;
  height?: number;
  theme?: 'light' | 'dark';
  className?: string;
}

let SmilesDrawerLib: any = null;
let smilesLoadPromise: Promise<void> | null = null;

async function loadSmilesDrawer() {
  if (SmilesDrawerLib) return;
  if (smilesLoadPromise) return smilesLoadPromise;
  smilesLoadPromise = (async () => {
    try {
      const mod = await import('smiles-drawer');
      SmilesDrawerLib = mod.default || mod;
    } catch (e) {
      console.error('Failed to load smiles-drawer:', e);
    }
  })();
  return smilesLoadPromise;
}

const MoleculeRenderer = React.memo(function MoleculeRenderer({
  smiles,
  width = 300,
  height = 200,
  theme = 'light',
  className = '',
}: MoleculeRendererProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadSmilesDrawer().then(() => {
      if (!cancelled) setLoaded(true);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!loaded || !svgRef.current || !SmilesDrawerLib) return;
    let cancelled = false;

    try {
      const drawer = new SmilesDrawerLib.SvgDrawer({
        width,
        height,
        bondThickness: 1.2,
        bondLength: 25,
        shortBondLength: 0.8,
        bondSpacing: 0.18 * 25,
        fontSizeLarge: 11,
        fontSizeSmall: 3,
        padding: 15,
        compactDrawing: true,
      });

      SmilesDrawerLib.parse(smiles, (tree: any) => {
        if (!cancelled && svgRef.current) {
          svgRef.current.innerHTML = '';
          drawer.draw(tree, svgRef.current, theme);
        }
      }, (e: any) => {
        if (!cancelled) setError(`Invalid SMILES: ${e.message || 'parse error'}`);
      });
    } catch (e: any) {
      if (!cancelled) setError(e.message || 'Failed to render molecule');
    }

    return () => { cancelled = true; };
  }, [loaded, smiles, width, height, theme]);

  if (error) {
    return (
      <div
        className={`inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-600 ${className}`}
      >
        <span className="font-mono text-[11px]">{smiles}</span>
        <span className="text-red-400">({error})</span>
      </div>
    );
  }

  return (
    <div className={`inline-flex flex-col items-center gap-1 ${className}`}>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="rounded-lg border border-[color-mix(in_srgb,var(--primary-text)_10%,transparent)] bg-white dark:bg-gray-900"
      />
      <span className="font-mono text-[10px] text-secondary-text">{smiles}</span>
    </div>
  );
});

export default MoleculeRenderer;
