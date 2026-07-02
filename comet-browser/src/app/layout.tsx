"use client";

import { useAppStore } from '@/store/useAppStore';
import type { Metadata } from "next";
import "./globals.css";
import { useEffect } from 'react';

import TitleBar from "@/components/TitleBar";
import { ErrorBoundary } from "@/components/ErrorBoundary";


// Metadata cannot be exported from a client component directly.
// If critical, define it in a separate `metadata.ts` file or a parent server component.
// export const metadata: Metadata = {
//   title: "Comet Browser",
//   description: "An AI-integrated browser application",
// };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const store = useAppStore();
  const isLandingPage = store.activeView === 'landing-page';

  useEffect(() => {
    const unsubscribeSuspend = window.electronAPI?.onTabSuspended((tabId) => {
      store.suspendTab(tabId);
    });

    const unsubscribeResume = window.electronAPI?.onTabResumed((tabId) => {
      store.resumeTab(tabId);
    });

    const unsubscribeResumeAndActivate = window.electronAPI?.onResumeTabAndActivate((tabId) => {
      const tab = store.tabs.find(t => t.id === tabId);
      if (tab) {
        store.resumeTab(tabId);
        window.electronAPI?.createView({ tabId, url: tab.url });
        setTimeout(() => {
          window.electronAPI?.activateView({
            tabId: tabId,
            bounds: { x: 0, y: 40, width: 1200, height: 760 }
          });
          store.setActiveTabId(tabId);
        }, 100);
      }
    });

    // Listen for auth-callback from OAuth redirect
    const unsubscribeAuthCallback = window.electronAPI?.onAuthCallback((url: string) => {
      console.log('[Layout] Auth callback received:', url);
    });

    return () => {
      unsubscribeSuspend?.();
      unsubscribeResume?.();
      unsubscribeResumeAndActivate?.();
      unsubscribeAuthCallback?.();
    };
  }, [store]);

  return (
    <html lang="en" className={store.theme === 'system' ? '' : store.theme}>
      <body className={`font-sans antialiased bg-deep-space-bg ${isLandingPage ? 'overflow-auto' : 'overflow-hidden'} h-screen`}>
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </body>
    </html>
  );
}
