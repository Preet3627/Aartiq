"use client";

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface WidgetErrorBoundaryProps {
  children: React.ReactNode;
  widgetName: string;
}

interface WidgetErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class WidgetErrorBoundary extends React.Component<WidgetErrorBoundaryProps, WidgetErrorBoundaryState> {
  constructor(props: WidgetErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): WidgetErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.error(`[WidgetErrorBoundary] ${this.props.widgetName}:`, error);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-4 px-3 text-center rounded-lg bg-red-500/5 border border-red-500/10">
          <AlertTriangle size={14} className="text-red-400 mb-1.5" />
          <p className="text-[9px] font-bold text-red-400/70 uppercase tracking-wider">{this.props.widgetName}</p>
          <p className="text-[8px] text-secondary-text/40 mt-0.5 mb-2">This widget encountered an error</p>
          <button
            onClick={this.handleReset}
            className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/[0.06] hover:bg-white/[0.1] text-[8px] font-medium text-secondary-text/60 hover:text-secondary-text transition-all"
          >
            <RefreshCw size={9} /> Restore
          </button>
          {this.state.error && (
            <details className="mt-2 w-full">
              <summary className="text-[7px] text-secondary-text/30 cursor-pointer hover:text-secondary-text/50">Details</summary>
              <pre className="mt-1 text-[7px] text-red-400/50 text-left whitespace-pre-wrap max-h-20 overflow-y-auto">
                {this.state.error.message}
              </pre>
            </details>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
