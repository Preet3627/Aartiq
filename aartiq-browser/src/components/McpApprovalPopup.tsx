'use client';

import React, { useEffect, useState, useCallback } from 'react';

interface ApprovalRequest {
  requestId: string;
  tool: string;
  risk: string;
  args: any;
  url?: string;
}

function McpApprovalPopup() {
  const [request, setRequest] = useState<ApprovalRequest | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'pending' | 'approved' | 'denied'>('pending');

  useEffect(() => {
    const unsub = (window as any).electronAPI?.onMcpApprovalPending?.((details: ApprovalRequest) => {
      setRequest(details);
      setStatus('pending');
    });
    return () => unsub?.();
  }, []);

  const handleApprove = useCallback(async () => {
    if (!request) return;
    setLoading(true);
    await (window as any).electronAPI?.mcpApprovalRespond?.(request.requestId, true);
    setStatus('approved');
    setLoading(false);
  }, [request]);

  const handleDeny = useCallback(async () => {
    if (!request) return;
    setLoading(true);
    await (window as any).electronAPI?.mcpApprovalRespond?.(request.requestId, false);
    setStatus('denied');
    setLoading(false);
  }, [request]);

  useEffect(() => {
    if (!request || status !== 'pending') return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Tab' && e.shiftKey) {
        e.preventDefault();
        handleApprove();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        handleDeny();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [request, status, handleApprove, handleDeny]);

  const riskColor = request?.risk === 'high' ? 'text-red-400' : request?.risk === 'medium' ? 'text-orange-400' : 'text-green-400';
  const riskBg = request?.risk === 'high' ? 'bg-red-500/10 border-red-500/30' : request?.risk === 'medium' ? 'bg-orange-500/10 border-orange-500/30' : 'bg-green-500/10 border-green-500/30';

  if (!request) {
    return (
      <div className="h-screen w-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-gray-800 flex items-center justify-center">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H10" />
            </svg>
          </div>
          <h2 className="text-sm font-bold text-gray-400">No pending MCP requests</h2>
          <p className="text-xs text-gray-600 mt-1">Waiting for tool approval...</p>
        </div>
      </div>
    );
  }

  if (status === 'approved') {
    return (
      <div className="h-screen w-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
            <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-sm font-bold text-green-400">Approved</h2>
          <p className="text-xs text-gray-500 mt-1">Request completed</p>
        </div>
      </div>
    );
  }

  if (status === 'denied') {
    return (
      <div className="h-screen w-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
            <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-sm font-bold text-red-400">Denied</h2>
          <p className="text-xs text-gray-500 mt-1">Request cancelled</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-gray-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-2xl">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H10" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">MCP Tool Request</h2>
              <p className="text-xs text-gray-400">Claude Desktop requires approval</p>
            </div>
          </div>

          <div className={`border rounded-xl p-3 mb-4 ${riskBg}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Tool</span>
              <span className={`text-xs font-bold uppercase ${riskColor}`}>{request.risk} RISK</span>
            </div>
            <p className="text-sm font-mono text-white bg-gray-950/50 rounded-lg px-2 py-1.5">{request.tool}</p>
          </div>

          {request.args && Object.keys(request.args).length > 0 && (
            <div className="border border-gray-800 rounded-xl p-3 mb-4 bg-gray-950/30">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Arguments</span>
              <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap max-h-32 overflow-y-auto">
                {JSON.stringify(request.args, null, 2)}
              </pre>
            </div>
          )}

          <div className="border border-gray-800 rounded-xl p-3 mb-5 bg-gray-950/30">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 block">Source</span>
            <p className="text-xs text-gray-500">Claude Desktop via MCP</p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleDeny}
              disabled={loading}
              className="flex-1 px-4 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-bold transition-colors disabled:opacity-50"
            >
              Deny
            </button>
            <button
              onClick={handleApprove}
              disabled={loading}
              className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold transition-colors disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Approve'}
            </button>
          </div>

          <div className="flex items-center justify-center gap-1.5 mt-3">
            <kbd className="px-1.5 py-0.5 rounded bg-gray-800 border border-gray-700 text-[9px] font-mono text-gray-500">Shift</kbd>
            <span className="text-[9px] text-gray-600">+</span>
            <kbd className="px-1.5 py-0.5 rounded bg-gray-800 border border-gray-700 text-[9px] font-mono text-gray-500">Tab</kbd>
            <span className="text-[9px] text-gray-600 ml-1">to quick-approve</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default McpApprovalPopup;
