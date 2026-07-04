import React, { useEffect, useRef, memo, useState } from 'react';

interface FlowchartDiagramProps {
  diagramId: string;
  code: string;
}

interface FlowchartNode {
  id: string;
  text: string;
  next?: string[];
  type?: 'start' | 'end' | 'decision' | 'process';
}

interface FlowchartLink {
  from: string;
  to: string;
  label?: string;
}

const parseFlowchartText = (code: string): { nodes: FlowchartNode[]; links: FlowchartLink[] } => {
  const lines = code.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const nodes: FlowchartNode[] = [];
  const links: FlowchartLink[] = [];
  const nodeMap = new Map<string, FlowchartNode>();

  for (const line of lines) {
    if (line.startsWith('[') && line.endsWith(']')) {
      const id = `node-${nodes.length}`;
      const text = line.slice(1, -1);
      const node: FlowchartNode = { id, text, type: 'process' };
      nodes.push(node);
      nodeMap.set(id, node);
    } else if (line.startsWith('(') && line.endsWith(')')) {
      const id = `node-${nodes.length}`;
      const text = line.slice(1, -1);
      const node: FlowchartNode = { id, text, type: 'start' };
      nodes.push(node);
      nodeMap.set(id, node);
    } else if (line.startsWith('{') && line.endsWith('}')) {
      const id = `node-${nodes.length}`;
      const text = line.slice(1, -1);
      const node: FlowchartNode = { id, text, type: 'decision' };
      nodes.push(node);
      nodeMap.set(id, node);
    } else if (line.includes('->')) {
      const [from, toWithLabel] = line.split('->').map(s => s.trim());
      const toParts = toWithLabel.split('|');
      const to = toParts[0].trim();
      const label = toParts[1]?.trim();

      let fromNode = nodeMap.get(from);
      if (!fromNode) {
        fromNode = { id: from, text: from, type: 'process' };
        nodeMap.set(from, fromNode);
        if (!nodes.find(n => n.id === from)) nodes.push(fromNode);
      }

      let toNode = nodeMap.get(to);
      if (!toNode) {
        toNode = { id: to, text: to, type: 'process' };
        nodeMap.set(to, toNode);
        if (!nodes.find(n => n.id === to)) nodes.push(toNode);
      }

      fromNode.next = fromNode.next || [];
      fromNode.next.push(to);
      links.push({ from: from, to, label });
    }
  }

  return { nodes, links };
};

const FlowchartDiagram = memo(function FlowchartDiagram({ diagramId, code }: FlowchartDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);

  useEffect(() => {
    if (!code || code.trim().length < 5) {
      setError('Invalid or empty flowchart code');
      return;
    }

    setError(null);
    setIsRendering(true);

    const renderFlowchart = () => {
      if (!containerRef.current) return;

      try {
        const { nodes, links } = parseFlowchartText(code);

        if (nodes.length === 0) {
          setError('No valid flowchart nodes found');
          setIsRendering(false);
          return;
        }

        const svgWidth = Math.max(600, nodes.length * 120);
        const svgHeight = 400;
        const nodeWidth = 140;
        const nodeHeight = 50;
        const horizontalGap = 160;
        const verticalGap = 100;

        const startNode = nodes.find(n => n.type === 'start') || nodes[0];
        const endNode = nodes.find(n => n.type === 'end');

        const positions = new Map<string, { x: number; y: number }>();
        const levels = new Map<string, number>();
        const visited = new Set<string>();

        const layout = (nodeId: string, level: number, xOffset: number): number => {
          if (visited.has(nodeId)) return xOffset;
          visited.add(nodeId);
          levels.set(nodeId, level);

          const node = nodes.find(n => n.id === nodeId);
          if (!node) return xOffset;

          positions.set(nodeId, { x: level * horizontalGap + 50, y: xOffset * verticalGap + 50 });

          if (node.next && node.next.length > 0) {
            let nextX = xOffset;
            for (const nextId of node.next) {
              nextX = layout(nextId, level + 1, nextX);
            }
            return Math.max(nextX, xOffset + node.next.length);
          }

          return xOffset + 1;
        };

        layout(startNode.id, 0, 0);

        let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" class="flowchart-svg">
          <defs>
            <marker id="arrowhead-${diagramId}" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="#0ea5e9"/>
            </marker>
            <linearGradient id="grad-${diagramId}" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:#0ea5e9;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#8b5cf6;stop-opacity:1" />
            </linearGradient>
          </defs>
        `;

        for (const link of links) {
          const fromPos = positions.get(link.from);
          const toPos = positions.get(link.to);
          if (fromPos && toPos) {
            const x1 = fromPos.x + nodeWidth;
            const y1 = fromPos.y + nodeHeight / 2;
            const x2 = toPos.x;
            const y2 = toPos.y + nodeHeight / 2;

            const midX = (x1 + x2) / 2;

            svg += `<path d="M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}"
                    stroke="url(#grad-${diagramId})" stroke-width="2" fill="none"
                    marker-end="url(#arrowhead-${diagramId})" />`;

            if (link.label) {
              svg += `<text x="${midX}" y="${(y1 + y2) / 2 - 10}" fill="#94a3b8" font-size="12" text-anchor="middle">${link.label}</text>`;
            }
          }
        }

        for (const node of nodes) {
          const pos = positions.get(node.id);
          if (!pos) continue;

          let shape = '';
          const isStart = node.type === 'start';
          const isEnd = node.type === 'end';
          const isDecision = node.type === 'decision';

          const gradientId = `node-grad-${node.id}`;

          svg += `<defs>
            <linearGradient id="${gradientId}" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:${isStart ? '#22c55e' : isEnd ? '#ef4444' : isDecision ? '#f59e0b' : '#0ea5e9'};stop-opacity:0.8" />
              <stop offset="100%" style="stop-color:${isStart ? '#16a34a' : isEnd ? '#dc2626' : isDecision ? '#d97706' : '#8b5cf6'};stop-opacity:0.8" />
            </linearGradient>
          </defs>`;

          if (isStart || isEnd) {
            const rx = nodeHeight / 2;
            shape = `<rect x="${pos.x}" y="${pos.y}" width="${nodeWidth}" height="${nodeHeight}" rx="${rx}" ry="${rx}"
                     fill="url(#${gradientId})" stroke="#fff" stroke-width="2"/>`;
          } else if (isDecision) {
            const cx = pos.x + nodeWidth / 2;
            const cy = pos.y + nodeHeight / 2;
            const points = `${cx},${pos.y} ${pos.x + nodeWidth},${cy} ${cx},${pos.y + nodeHeight} ${pos.x},${cy}`;
            shape = `<polygon points="${points}" fill="url(#${gradientId})" stroke="#fff" stroke-width="2"/>`;
          } else {
            shape = `<rect x="${pos.x}" y="${pos.y}" width="${nodeWidth}" height="${nodeHeight}" rx="8" ry="8"
                     fill="url(#${gradientId})" stroke="#fff" stroke-width="2"/>`;
          }

          const textX = pos.x + nodeWidth / 2;
          const textY = pos.y + nodeHeight / 2 + 4;
          const text = node.text.length > 18 ? node.text.slice(0, 16) + '...' : node.text;

          svg += `${shape}
            <text x="${textX}" y="${textY}" fill="white" font-size="12" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-weight="600">${text}</text>`;
        }

        svg += '</svg>';

        containerRef.current.innerHTML = svg;
        setError(null);
      } catch (err) {
        console.error('[Flowchart] Render error:', err);
        setError(err instanceof Error ? err.message : 'Failed to render flowchart');
      } finally {
        setIsRendering(false);
      }
    };

    renderFlowchart();
  }, [diagramId, code]);

  return (
    <div className="my-5 rounded-3xl overflow-hidden border border-white/5 bg-slate-900/50 p-6 flex flex-col items-center shadow-2xl">
      <style>{`
        .flowchart-svg {
          width: 100%;
          max-width: 100%;
          height: auto;
        }
      `}</style>
      {isRendering && (
        <div className="flex items-center gap-2 text-emerald-400 text-sm mb-4">
          <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
          Rendering flowchart...
        </div>
      )}
      <div
        ref={containerRef}
        className="flowchart-container w-full flex justify-center"
        style={{ minHeight: error ? 'auto' : '200px' }}
      />
      {error && !isRendering && (
        <div className="mt-4 text-red-400 text-sm p-4 bg-red-900/20 rounded-lg border border-red-500/30">
          <p className="font-bold">Flowchart Error</p>
          <p className="text-xs mt-1">{error}</p>
        </div>
      )}
    </div>
  );
});

export default FlowchartDiagram;
