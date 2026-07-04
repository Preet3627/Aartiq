'use client';

import { useMemo, useState } from 'react';
import { useAppVersion } from '@/lib/useAppVersion';

const quickActions = [
  {
    title: 'Generate Daily Brief',
    subtitle: 'Summarize emails, meetings, and high-priority tasks automatically.',
    icon: '📄'
  },
  {
    title: 'Clipboard Sync Watcher',
    subtitle: 'Auto-distribute the latest clipboard across trusted devices.',
    icon: '📋'
  },
  {
    title: 'PDF Report',
    subtitle: 'Render branded AI intelligence reports and share them securely.',
    icon: '📑'
  }
];

const defaultSettings = [
  { key: 'autoRunCommands', label: 'Auto-run low-risk commands', value: true },
  { key: 'notifications', label: 'Desktop push notifications', value: true },
  { key: 'betaFeatures', label: 'Expose SwiftUI controls', value: false },
  { key: 'syncTasks', label: 'Sync task metadata to mobile', value: true }
];

const MacAiSidebarPage = () => {
  const versionLabel = `v${useAppVersion()}`;
  const [activeAction, setActiveAction] = useState(quickActions[0].title);
  const [settingsState, setSettingsState] = useState(
    () => Object.fromEntries(defaultSettings.map(setting => [setting.key, setting.value]))
  );

  const activeCard = useMemo(
    () => quickActions.find(action => action.title === activeAction) || quickActions[0],
    [activeAction]
  );

  const toggleSetting = (key: string) => {
    setSettingsState(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        padding: '32px',
        display: 'flex',
        flexDirection: 'column',
        background: 'rgba(20, 20, 30, 0.85)',
        backdropFilter: 'blur(40px)',
        color: '#f8fafc',
        fontFamily: "'Outfit', 'Inter', system-ui, sans-serif",
        border: '1px solid rgba(255,255,255,0.1)'
      }}
    >
      <header style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '0.7rem', letterSpacing: '0.4em', textTransform: 'uppercase', color: '#94a3b8' }}>
              SwiftUI Inspired
            </div>
            <h1 style={{ margin: '6px 0', fontSize: '1.7rem', fontWeight: 800 }}>Aartiq Panel</h1>
            <p style={{ margin: 0, color: '#cbd5f5', fontSize: '0.9rem' }}>
              Native translucent controls and settings for macOS builds only
            </p>
          </div>
          <button
            onClick={() => window.close()}
            style={{
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: '999px',
              padding: '6px 14px',
              background: 'rgba(255,255,255,0.05)',
              color: '#f8fafc',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Close
          </button>
        </div>
      </header>

      <div style={{ flexGrow: 1, display: 'grid', gridTemplateColumns: '2fr 3fr', gap: '20px' }}>
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.65)',
            borderRadius: '20px',
            padding: '16px',
            border: '1px solid rgba(255,255,255,0.05)',
            boxShadow: '0 20px 60px rgba(15,23,42,0.6)'
          }}
        >
          <div style={{ fontSize: '0.75rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#94a3b8', marginBottom: '12px' }}>
            Actions
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {quickActions.map(action => (
              <button
                key={action.title}
                onClick={() => setActiveAction(action.title)}
                style={{
                  textAlign: 'left',
                  padding: '14px',
                  borderRadius: '16px',
                  border: '1px solid',
                  borderColor: activeAction === action.title ? 'rgba(94, 234, 212, 0.7)' : 'transparent',
                  background: activeAction === action.title ? 'rgba(14, 165, 233, 0.15)' : 'transparent',
                  color: '#f8fafc',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  cursor: 'pointer'
                }}
              >
                <span style={{ fontSize: '1.6rem' }}>{action.icon}</span>
                <strong style={{ fontSize: '1rem' }}>{action.title}</strong>
                <small style={{ color: '#a5b4fc' }}>{action.subtitle}</small>
              </button>
            ))}
          </div>
        </div>

        <div
          style={{
            background: 'rgba(15, 23, 42, 0.65)',
            borderRadius: '24px',
            padding: '24px',
            border: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <div style={{ fontSize: '0.75rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#cbd5f5' }}>
              {activeCard.title}
            </div>
            <p style={{ color: '#e2e8f0', fontSize: '1.1rem', margin: '12px 0' }}>
              {activeCard.subtitle}
            </p>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {[1, 2, 3].map(ticket => (
                <span
                  key={ticket}
                  style={{
                    fontSize: '0.75rem',
                    padding: '6px 10px',
                    borderRadius: '999px',
                    border: '1px solid rgba(255,255,255,0.2)',
                    color: '#f8fafc'
                  }}
                >
                  Task {ticket}
                </span>
              ))}
            </div>
          </div>

          <div style={{ marginTop: '24px' }}>
            <div style={{ fontSize: '0.75rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#94a3b8', marginBottom: '18px' }}>
              Settings
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {defaultSettings.map(setting => (
                <label
                  key={setting.key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'rgba(255,255,255,0.02)',
                    borderRadius: '14px',
                    padding: '12px 16px'
                  }}
                >
                  <span style={{ color: '#e2e8f0' }}>{setting.label}</span>
                  <button
                    onClick={() => toggleSetting(setting.key)}
                    style={{
                      width: '44px',
                      height: '24px',
                      borderRadius: '999px',
                      border: '1px solid rgba(255,255,255,0.2)',
                      background: settingsState[setting.key] ? 'rgba(94, 234, 212, 0.6)' : 'rgba(226, 232, 240, 0.15)',
                      position: 'relative',
                      cursor: 'pointer'
                    }}
                  >
                    <span
                      style={{
                        position: 'absolute',
                        top: '2px',
                        left: settingsState[setting.key] ? '22px' : '2px',
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        background: '#0f172a',
                        transition: 'left 0.2s ease'
                      }}
                    />
                  </button>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      <footer style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#94a3b8' }}>
        <span>Live on macOS build · SwiftUI-inspired sheet</span>
        <span>{versionLabel}</span>
      </footer>
    </div>
  );
};

export default MacAiSidebarPage;
