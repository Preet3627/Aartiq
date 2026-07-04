import React, { useEffect, useRef, memo, useState } from 'react';
import mermaid from 'mermaid';

if (typeof document !== 'undefined') {
  (HTMLElement.prototype as any).toJSON = () => '';
}

mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  securityLevel: 'loose',
  fontFamily: 'inherit',
  themeVariables: {
    primaryColor: '#0ea5e9',
    primaryTextColor: '#fff',
    primaryBorderColor: '#0ea5e9',
    lineColor: '#64748b',
    secondaryColor: '#1e293b',
    tertiaryColor: '#0f172a',
    background: '#0f172a',
    mainBkg: '#1e293b',
    nodeBorder: '#0ea5e9',
    clusterBkg: '#1e293b',
    clusterBorder: '#334155',
    titleColor: '#fff',
    edgeLabelBackground: '#0f172a',
  },
  flowchart: { useMaxWidth: true, htmlLabels: true, curve: 'basis' },
});

interface MermaidDiagramProps {
  diagramId: string;
  code: string;
}

const MermaidDiagram = memo(function MermaidDiagram({ diagramId, code }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);

  useEffect(() => {
    if (!code || code.trim().length < 10) {
      setError('Invalid or empty Mermaid diagram code');
      return;
    }

    setError(null);
    setIsRendering(true);

    let cancelled = false;

    const renderDiagram = async () => {
      if (!containerRef.current) return;
      
      try {
        const uniqueId = `mermaid-${diagramId}-${Date.now()}`;
        const cleanCode = code.trim().replace(/\n$/gm, '');
        
        let svg: string;
        try {
          const result = await mermaid.render(uniqueId, cleanCode);
          svg = result.svg;
        } catch (renderErr) {
          console.warn('[Mermaid] Direct render failed, trying parse:', renderErr);
          try {
            await mermaid.parse(cleanCode);
            const result = await mermaid.render(uniqueId, cleanCode);
            svg = result.svg;
          } catch (parseErr) {
            throw parseErr;
          }
        }
        
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;
          setError(null);
        }
      } catch (err) {
        console.error('[Mermaid] Render error:', err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Invalid Mermaid syntax');
          if (containerRef.current) {
            const errorMsg = err instanceof Error ? err.message : 'Invalid Mermaid syntax';
            containerRef.current.innerHTML = `
              <div class="text-red-400 text-sm p-4 bg-red-900/20 rounded-lg border border-red-500/30">
                <p class="font-bold">Diagram Error</p>
                <p class="text-xs mt-1">${errorMsg}</p>
                <pre class="mt-2 text-xs text-white/60 overflow-x-auto">${code.slice(0, 500)}</pre>
              </div>
            `;
          }
        }
      } finally {
        if (!cancelled) {
          setIsRendering(false);
        }
      }
    };

    renderDiagram();

    return () => {
      cancelled = true;
    };
  }, [diagramId, code]);

  return (
    <div className="my-5 rounded-3xl overflow-hidden border border-white/5 bg-slate-900/50 p-6 flex flex-col items-center shadow-2xl">
      {isRendering && (
        <div className="flex items-center gap-2 text-sky-400 text-sm">
          <div className="w-4 h-4 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
          Rendering diagram...
        </div>
      )}
      <div
        ref={containerRef}
        className="mermaid-container w-full flex justify-center"
        style={{ minHeight: error ? 'auto' : '100px' }}
      />
      {error && !isRendering && (
        <pre className="mt-2 text-xs text-white/40 overflow-x-auto max-w-full bg-black/20 p-2 rounded-lg">
          {code.slice(0, 300)}
        </pre>
      )}
    </div>
  );
});

export default MermaidDiagram;