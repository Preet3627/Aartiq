import React, { useEffect, useRef, memo, useState } from 'react';

interface ChartData {
  labels?: string[];
  datasets: Array<{
    label?: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string | string[];
    borderWidth?: number;
    fill?: boolean;
  }>;
}

interface ChartOptions {
  type?: 'bar' | 'line' | 'pie' | 'doughnut' | 'radar' | 'scatter';
  title?: string;
  colors?: string[];
}

interface ChartDiagramProps {
  chartId: string;
  data: ChartData;
  options?: ChartOptions;
}

const DEFAULT_COLORS = [
  '#0ea5e9', '#8b5cf6', '#22c55e', '#f59e0b', '#ef4444',
  '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#a855f7'
];

const ChartDiagram = memo(function ChartDiagram({ chartId, data, options = {} }: ChartDiagramProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);

  useEffect(() => {
    if (!data || !data.datasets || data.datasets.length === 0) {
      setError('Invalid chart data');
      return;
    }

    setError(null);
    setIsRendering(true);

    const renderChart = async () => {
      if (!canvasRef.current) return;

      try {
        const Chart = (await import('chart.js/auto')).default;

        const chartType = options.type || 'bar';
        const colors = options.colors || DEFAULT_COLORS;

        const processedDatasets = data.datasets.map((dataset, idx) => ({
          ...dataset,
          backgroundColor: dataset.backgroundColor || colors[idx % colors.length] + '80',
          borderColor: dataset.borderColor || colors[idx % colors.length],
          borderWidth: dataset.borderWidth || 2,
        }));

        if (chartRef.current) {
          chartRef.current.destroy();
        }

        chartRef.current = new Chart(canvasRef.current, {
          type: chartType as any,
          data: {
            labels: data.labels || data.datasets[0]?.data.map((_, i) => `Item ${i + 1}`),
            datasets: processedDatasets,
          },
          options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
              legend: {
                display: true,
                position: 'top' as const,
                labels: {
                  color: '#94a3b8',
                  font: { family: 'Inter', size: 11 },
                },
              },
              title: {
                display: !!options.title,
                text: options.title || '',
                color: '#f1f5f9',
                font: { family: 'Outfit', size: 14, weight: 'bold' as const },
              },
            },
            scales: chartType !== 'pie' && chartType !== 'doughnut' ? {
              x: {
                grid: { color: '#334155' },
                ticks: { color: '#94a3b8', font: { family: 'Inter', size: 10 } },
              },
              y: {
                grid: { color: '#334155' },
                ticks: { color: '#94a3b8', font: { family: 'Inter', size: 10 } },
              },
            } : undefined,
          },
        });

        setError(null);
      } catch (err) {
        console.error('[Chart] Render error:', err);
        setError(err instanceof Error ? err.message : 'Failed to render chart');
      } finally {
        setIsRendering(false);
      }
    };

    renderChart();

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [chartId, JSON.stringify(data), JSON.stringify(options)]);

  const chartRef = useRef<any>(null);

  return (
    <div className="my-5 rounded-3xl overflow-hidden border border-white/5 bg-slate-900/50 p-6 flex flex-col items-center shadow-2xl">
      {isRendering && (
        <div className="flex items-center gap-2 text-purple-400 text-sm mb-4">
          <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
          Rendering chart...
        </div>
      )}
      <div className="w-full max-w-lg">
        <canvas ref={canvasRef} id={`chart-${chartId}`} />
      </div>
      {error && !isRendering && (
        <div className="mt-4 text-red-400 text-sm p-4 bg-red-900/20 rounded-lg border border-red-500/30">
          <p className="font-bold">Chart Error</p>
          <p className="text-xs mt-1">{error}</p>
        </div>
      )}
    </div>
  );
});

export default ChartDiagram;
