'use client';

import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, Save, Bot, Zap, ChevronDown, AlertCircle } from 'lucide-react';

interface SchedulingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (config: ScheduleConfig) => void;
  taskDetails: {
    taskName: string;
    taskType: 'ai-prompt' | 'web-scrape' | 'pdf-generate' | 'workflow' | 'daily-brief' | 'shell';
    schedule: string;
    description?: string;
  };
}

interface ScheduleConfig {
  schedule: string;
  scheduleType: 'cron' | 'once' | 'interval';
  timezone: string;
  outputPath: string;
  model: {
    provider: string;
    model: string;
  };
  notification: {
    onStart: boolean;
    onComplete: boolean;
    onError: boolean;
  };
  enabled: boolean;
}

interface ModelOption {
  id: string;
  name: string;
  provider: string;
  icon: string;
  recommended?: boolean;
  tier?: string;
}

const AVAILABLE_MODELS: ModelOption[] = [
  { id: 'gemini-2.0-flash', name: 'Gemini Flash', provider: 'gemini', icon: '🔥', recommended: true },
  { id: 'gemini-1.5-pro', name: 'Gemini Pro', provider: 'gemini', icon: '🔥' },
  { id: 'deepseek-r1:8b', name: 'DeepSeek R1 8B', provider: 'ollama', icon: '🖥️', recommended: true, tier: 'Local' },
  { id: 'deepseek-r1:14b', name: 'DeepSeek R1 14B', provider: 'ollama', icon: '🖥️', tier: 'Local' },
  { id: 'llama3:8b', name: 'Llama 3 8B', provider: 'ollama', icon: '🖥️', tier: 'Local' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', icon: '☁️' },
  { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', provider: 'anthropic', icon: '🤖' },
];

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Kolkata',
  'Australia/Sydney',
  'UTC',
];

const CRON_PRESETS = [
  { label: 'Daily at 8:00 AM', value: '0 8 * * *' },
  { label: 'Daily at 6:00 PM', value: '0 18 * * *' },
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Every 30 minutes', value: '*/30 * * * *' },
  { label: 'Weekdays at 9:00 AM', value: '0 9 * * 1-5' },
  { label: 'Every Monday at 9:00 AM', value: '0 9 * * 1' },
  { label: 'First day of month at 8:00 AM', value: '0 8 1 * *' },
];

import { useAppStore } from '@/store/useAppStore';

export default function SchedulingModal({
  isOpen,
  onClose,
  onConfirm,
  taskDetails,
}: SchedulingModalProps) {
  const store = useAppStore();
  const resolvedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  
  const [config, setConfig] = useState<ScheduleConfig>({
    schedule: taskDetails.schedule || '0 8 * * *',
    scheduleType: 'cron',
    timezone: resolvedTimezone,
    outputPath: '~/Documents/Aartiq',
    model: {
      provider: store.aiProvider || 'gemini',
      model: store.aiProvider === 'google' ? store.geminiModel :
             store.aiProvider === 'ollama' ? store.ollamaModel :
             store.aiProvider === 'openai' ? store.openaiModel :
             store.aiProvider === 'azure-openai' ? store.azureOpenaiModel :
             store.aiProvider === 'anthropic' ? store.anthropicModel :
             store.aiProvider === 'groq' ? store.groqModel : 'gemini-2.0-flash',
    },
    notification: {
      onStart: false,
      onComplete: true,
      onError: true,
    },
    enabled: true,
  });

  const [showModelPicker, setShowModelPicker] = useState(false);
  const [showTimezonePicker, setShowTimezonePicker] = useState(false);
  const [showOutputPicker, setShowOutputPicker] = useState(false);
  const [customCron, setCustomCron] = useState('');
  const [rememberChoice, setRememberChoice] = useState(false);

  useEffect(() => {
    if (taskDetails.schedule) {
      setConfig(prev => ({ ...prev, schedule: taskDetails.schedule }));
    }
  }, [taskDetails.schedule]);

  useEffect(() => {
    if (isOpen) {
      setConfig(prev => ({ ...prev, timezone: resolvedTimezone }));
    }
  }, [isOpen, resolvedTimezone]);

  if (!isOpen) return null;

  const handleCronSelect = (cronValue: string) => {
    setConfig(prev => ({ ...prev, schedule: cronValue }));
  };

  const handleModelSelect = (model: ModelOption) => {
    setConfig(prev => ({
      ...prev,
      model: {
        provider: model.provider,
        model: model.id,
      },
    }));
    setShowModelPicker(false);
  };

  const handleOutputSelect = (path: string) => {
    setConfig(prev => ({ ...prev, outputPath: path }));
    setShowOutputPicker(false);
  };

  const handleConfirm = async () => {
    try {
      if (window.electronAPI?.scheduleTask) {
        await window.electronAPI.scheduleTask({
          name: taskDetails.taskName,
          description: taskDetails.description || '',
          type: taskDetails.taskType,
          schedule: config.schedule,
          cronExpression: config.schedule,
          outputPath: config.outputPath,
          model: config.model.model,
          provider: config.model.provider,
          notification: config.notification,
          enabled: config.enabled,
        });
        // Signal AutomationSettings to reload
        window.dispatchEvent(new CustomEvent('automation-task-created'));
      }
    } catch (err) {
      console.error('[SchedulingModal] Failed to save task:', err);
    }
    onConfirm(config);
    onClose();
  };

  const formatSchedule = (cron: string): string => {
    const preset = CRON_PRESETS.find(p => p.value === cron);
    if (preset) return preset.label;

    const parts = cron.split(' ');
    if (parts.length !== 5) return cron;

    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

    if (dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
      return `Daily at ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
    }
    if (dayOfWeek === '1-5') {
      return `Weekdays at ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
    }

    return cron;
  };

  const getSelectedModel = (): ModelOption => {
    return AVAILABLE_MODELS.find(m => m.id === config.model.model) || AVAILABLE_MODELS[0];
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden border border-white/10">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Schedule Task</h2>
              <p className="text-xs text-white/50">{taskDetails.taskName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-white/60" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto pr-3 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20">
          {/* Schedule Section */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              <Clock className="w-4 h-4 inline mr-1" />
              Schedule
            </label>
            <div className="grid grid-cols-2 gap-2">
              {CRON_PRESETS.slice(0, 6).map(preset => (
                <button
                  key={preset.value}
                  onClick={() => handleCronSelect(preset.value)}
                  className={`p-3 rounded-xl text-left transition-all ${
                    config.schedule === preset.value
                      ? 'bg-cyan-500/20 border-2 border-cyan-500/50 text-cyan-400'
                      : 'bg-white/5 border border-white/10 text-white/70 hover:bg-white/10'
                  }`}
                >
                  <span className="text-sm">{preset.label}</span>
                </button>
              ))}
            </div>
            
            {/* Custom cron input */}
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                value={customCron}
                onChange={(e) => setCustomCron(e.target.value)}
                placeholder="Custom cron (e.g., 0 8 * * *)"
                className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white/70 text-sm focus:outline-none focus:border-cyan-500/50"
              />
              <button
                onClick={() => {
                  if (customCron) handleCronSelect(customCron);
                }}
                className="px-4 py-2 bg-cyan-500/20 text-cyan-400 rounded-lg text-sm hover:bg-cyan-500/30 transition-colors"
              >
                Apply
              </button>
            </div>
          </div>

          {/* Timezone */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              Timezone
            </label>
            <div className="relative">
              <button
                onClick={() => setShowTimezonePicker(!showTimezonePicker)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-left text-white flex items-center justify-between hover:bg-white/10 transition-colors"
              >
                <span>{config.timezone}</span>
                <ChevronDown className="w-4 h-4 text-white/50" />
              </button>
              
              {showTimezonePicker && (
                <div className="absolute z-10 mt-2 w-full bg-gray-800 border border-white/10 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                  {[...new Set([resolvedTimezone, ...TIMEZONES])].map(tz => (
                    <button
                      key={tz}
                      onClick={() => {
                        setConfig(prev => ({ ...prev, timezone: tz }));
                        setShowTimezonePicker(false);
                      }}
                      className={`w-full px-4 py-2 text-left text-sm hover:bg-white/10 transition-colors ${
                        config.timezone === tz ? 'text-cyan-400 bg-cyan-500/10' : 'text-white/70'
                      }`}
                    >
                      {tz}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Model Selection */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              <Bot className="w-4 h-4 inline mr-1" />
              AI Model
            </label>
            <div className="relative">
              <button
                onClick={() => setShowModelPicker(!showModelPicker)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-left flex items-center justify-between hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">{getSelectedModel().icon}</span>
                  <div>
                    <span className="text-white block">{getSelectedModel().name}</span>
                    <span className="text-xs text-white/50">{getSelectedModel().provider}</span>
                  </div>
                </div>
                <ChevronDown className="w-4 h-4 text-white/50" />
              </button>

              {showModelPicker && (
                <div className="absolute z-10 mt-2 w-full bg-gray-800 border border-white/10 rounded-xl shadow-xl max-h-64 overflow-y-auto">
                  {AVAILABLE_MODELS.map(model => (
                    <button
                      key={model.id}
                      onClick={() => handleModelSelect(model)}
                      className={`w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-white/10 transition-colors ${
                        config.model.model === model.id ? 'bg-cyan-500/10' : ''
                      }`}
                    >
                      <span className="text-lg">{model.icon}</span>
                      <div className="flex-1">
                        <span className="text-white block text-sm">
                          {model.name}
                          {model.recommended && (
                            <span className="ml-2 text-xs text-cyan-400">(Recommended)</span>
                          )}
                        </span>
                        <span className="text-xs text-white/50">{model.provider}</span>
                      </div>
                      {model.tier && (
                        <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded">
                          {model.tier}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Output Location */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              <Save className="w-4 h-4 inline mr-1" />
              Save Location
            </label>
            <div className="relative">
              <button
                onClick={() => setShowOutputPicker(!showOutputPicker)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-left text-white/70 flex items-center justify-between hover:bg-white/10 transition-colors"
              >
                <span className="truncate">{config.outputPath}</span>
                <ChevronDown className="w-4 h-4 text-white/50" />
              </button>

              {showOutputPicker && (
                <div className="absolute z-10 mt-2 w-full bg-gray-800 border border-white/10 rounded-xl shadow-xl">
                  {[
                    { path: '~/Documents/Aartiq', label: 'Documents/Aartiq (Default)' },
                    { path: '~/Desktop', label: 'Desktop' },
                    { path: '~/Downloads', label: 'Downloads' },
                    { path: '~/Documents', label: 'Documents' },
                  ].map(item => (
                    <button
                      key={item.path}
                      onClick={() => handleOutputSelect(item.path)}
                      className={`w-full px-4 py-3 text-left hover:bg-white/10 transition-colors ${
                        config.outputPath === item.path ? 'bg-cyan-500/10 text-cyan-400' : 'text-white/70'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                  <div className="p-3 border-t border-white/10">
                    <input
                      type="text"
                      placeholder="Custom path..."
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white/70 text-sm focus:outline-none focus:border-cyan-500/50"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleOutputSelect((e.target as HTMLInputElement).value);
                        }
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Notifications */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              Notifications
            </label>
            <div className="space-y-2">
              {[
                { key: 'onStart', label: 'Notify when task starts' },
                { key: 'onComplete', label: 'Notify on completion' },
                { key: 'onError', label: 'Notify on errors' },
              ].map(item => (
                <label
                  key={item.key}
                  className="flex items-center gap-3 p-3 bg-white/5 rounded-xl cursor-pointer hover:bg-white/10 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={config.notification[item.key as keyof typeof config.notification]}
                    onChange={(e) => {
                      setConfig(prev => ({
                        ...prev,
                        notification: {
                          ...prev.notification,
                          [item.key]: e.target.checked,
                        },
                      }));
                    }}
                    className="w-4 h-4 rounded border-white/30 bg-white/10 text-cyan-500 focus:ring-cyan-500/50"
                  />
                  <span className="text-sm text-white/70">{item.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Remember choice */}
          <label className="flex items-center gap-3 p-3 bg-cyan-500/10 rounded-xl cursor-pointer hover:bg-cyan-500/20 transition-colors">
            <input
              type="checkbox"
              checked={rememberChoice}
              onChange={(e) => setRememberChoice(e.target.checked)}
              className="w-4 h-4 rounded border-white/30 bg-white/10 text-cyan-500 focus:ring-cyan-500/50"
            />
            <div>
              <span className="text-sm text-cyan-400">Remember this choice</span>
              <p className="text-xs text-white/50">Apply these settings to similar tasks in the future</p>
            </div>
          </label>

          {/* Summary */}
          <div className="p-4 bg-white/5 rounded-xl border border-white/10">
            <div className="flex items-start gap-3">
              <Zap className="w-5 h-5 text-cyan-400 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-sm font-medium text-white">Task Summary</h4>
                <div className="mt-2 space-y-1 text-xs text-white/60">
                  <p><span className="text-white/40">Schedule:</span> {formatSchedule(config.schedule)}</p>
                  <p><span className="text-white/40">Timezone:</span> {config.timezone}</p>
                  <p><span className="text-white/40">Model:</span> {getSelectedModel().name}</p>
                  <p><span className="text-white/40">Save to:</span> {config.outputPath}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-5 border-t border-white/10">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-white/5 text-white/70 rounded-xl hover:bg-white/10 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 px-4 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium rounded-xl hover:from-cyan-400 hover:to-blue-400 transition-all shadow-lg shadow-cyan-500/25"
          >
            Schedule Task
          </button>
        </div>
      </div>
    </div>
  );
}
