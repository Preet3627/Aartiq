"use client";

import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
    if (typeof window !== 'undefined' && window.electronAPI?.logError) {
      window.electronAPI.logError(`ErrorBoundary: ${error.message}\n${error.stack}`);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          padding: '2rem',
          textAlign: 'center',
          background: '#0a0a1a',
          color: '#e0e0e0',
          fontFamily: 'system-ui, sans-serif',
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠</div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            Something went wrong
          </h1>
          <p style={{ color: '#888', marginBottom: '1.5rem', maxWidth: 400 }}>
            An unexpected error occurred. You can try reloading the page.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={this.handleReset}
              style={{
                padding: '0.6rem 1.5rem',
                borderRadius: '8px',
                border: 'none',
                background: '#00e5ff',
                color: '#0a0a1a',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '0.6rem 1.5rem',
                borderRadius: '8px',
                border: '1px solid #444',
                background: 'transparent',
                color: '#e0e0e0',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Reload Page
            </button>
          </div>
          {this.state.error && (
            <details style={{ marginTop: '2rem', maxWidth: 500, textAlign: 'left' }}>
              <summary style={{ cursor: 'pointer', color: '#666', fontSize: '0.85rem' }}>
                Error Details
              </summary>
              <pre style={{
                marginTop: '0.5rem',
                padding: '0.75rem',
                background: '#111',
                borderRadius: '6px',
                fontSize: '0.75rem',
                color: '#ff6b6b',
                overflow: 'auto',
                maxHeight: 200,
              }}>
                {this.state.error.message}
                {'\n'}
                {this.state.error.stack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
