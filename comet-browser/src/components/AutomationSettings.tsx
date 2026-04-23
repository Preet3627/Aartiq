"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap, Play, Pause, Trash2, Clock, FileText, Globe, MessageSquare,
  Briefcase, CheckCircle, XCircle, AlertCircle, Plus, Edit3, X,
  RefreshCw, CalendarDays, ToggleLeft, ToggleRight, Bot, Terminal,
  Settings, User, Lock, Shield, Cpu, Activity, Globe2, Save, FolderOpen
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { MODEL_REGISTRY } from '@/lib/modelRegistry';

interface Task {
  id: string;
  name: string;
  description?: string;
  type: string;
  schedule?: string;     // cron expression – may be undefined
  cronExpression?: string;
  trigger?: { cron?: string; type?: string };
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
  status?: 'idle' | 'running' | 'completed' | 'failed';
  result?: string;
  prompt?: string;
  outputPath?: string;
  model?: string;
  provider?: string;
}

const TASK_TYPES = [
  { value: 'pdf-generate', label: 'PDF Generation', icon: '📄' },
  { value: 'web-scrape', label: 'Web Scrape', icon: '🌐' },
  { value: 'ai-prompt', label: 'AI Prompt', icon: '🤖' },
  { value: 'workflow', label: 'Workflow', icon: '⚡' },
  { value: 'daily-brief', label: 'Daily Brief', icon: '📋' },
];

const SCHEDULE_PRESETS = [
  { label: 'Every hour', cron: '0 * * * *' },
  { label: 'Every 6 hours', cron: '0 */6 * * *' },
  { label: 'Daily at 8 AM', cron: '0 8 * * *' },
  { label: 'Daily at 12 PM', cron: '0 12 * * *' },
  { label: 'Weekdays at 9 AM', cron: '0 9 * * 1-5' },
  { label: 'Weekly (Monday)', cron: '0 9 * * 1' },
  { label: 'Custom…', cron: '' },
];

const safeCron = (task: Task): string => {
  return (
    task.schedule ||
    task.cronExpression ||
    task.trigger?.cron ||
    ''
  );
};

const formatSchedule = (cron: string | undefined | null): string => {
  if (!cron || typeof cron !== 'string') return 'No schedule';
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return cron;
  const [min, hour, dom, mon, dow] = parts;
  if (min === '0' && hour === '*' && dom === '*' && mon === '*' && dow === '*')
    return 'Every hour';
  if (min === `*/${min.replace('*/', '')}` && hour === '*')
    return `Every ${min.replace('*/', '')} minutes`;
  if (dom === '*' && mon === '*' && dow === '*')
    return `Daily at ${hour.padStart(2, '0')}:${min.padStart(2, '0')}`;
  if (dow === '1-5' && dom === '*')
    return `Weekdays at ${hour.padStart(2, '0')}:${min.padStart(2, '0')}`;
  if (dow === '1' && dom === '*')
    return `Weekly (Mon) at ${hour.padStart(2, '0')}:${min.padStart(2, '0')}`;
  if (dom !== '*' && mon !== '*')
    return `${mon}/${dom} at ${hour.padStart(2, '0')}:${min.padStart(2, '0')}`;
  return cron;
};

const EMPTY_FORM = {
  name: '',
  description: '',
  type: 'ai-prompt',
  cron: '0 8 * * *',
  prompt: '',
  outputPath: '',
  enabled: true,
  model: '',
  provider: '',
};

const FREQUENCIES = [
  { label: 'Hourly', value: 'hourly' },
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Custom (Cron)', value: 'custom' },
];

const DAYS_OF_WEEK = [
  { label: 'Mon', value: '1' },
  { label: 'Tue', value: '2' },
  { label: 'Wed', value: '3' },
  { label: 'Thu', value: '4' },
  { label: 'Fri', value: '5' },
  { label: 'Sat', value: '6' },
  { label: 'Sun', value: '0' },
];
const AutomationSettings = () => {
  const store = useAppStore();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'paused'>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [customCron, setCustomCron] = useState(false);
  const [saving, setSaving] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // GUI-based cron state
  const [frequency, setFrequency] = useState('daily');
  const [hour, setHour] = useState('08');
  const [minute, setMinute] = useState('00');
  const [selectedDays, setSelectedDays] = useState<string[]>(['1', '2', '3', '4', '5']);
  const [hourlyInterval, setHourlyInterval] = useState('1');
  const [serviceRunning, setServiceRunning] = useState(false);

  // Monitor service status
  useEffect(() => {
    const checkService = async () => {
      try {
        if (window.electronAPI?.getServiceStatus) {
          const status = await window.electronAPI.getServiceStatus();
          setServiceRunning(status.running);
        }
      } catch (e) {
        console.error('Service check failed:', e);
      }
    };
    checkService();
    const interval = setInterval(checkService, 5000);
    return () => clearInterval(interval);
  }, []);

  // Automatically update model when provider changes in the form
  useEffect(() => {
    if (!showForm) return;
    
    let defaultModel = '';
    switch (form.provider) {
      case 'google': defaultModel = store.geminiModel; break;
      case 'ollama': defaultModel = store.ollamaModel; break;
      case 'openai': defaultModel = store.openaiModel; break;
      case 'azure-openai': defaultModel = store.azureOpenaiModel; break;
      case 'anthropic': defaultModel = store.anthropicModel; break;
      case 'groq': defaultModel = store.groqModel; break;
      case 'xai': defaultModel = store.xaiModel; break;
    }
    
    if (defaultModel && !editingTask) {
      setForm(f => ({ ...f, model: defaultModel }));
    }
  }, [form.provider, showForm, editingTask, store.geminiModel, store.ollamaModel, store.openaiModel, store.azureOpenaiModel, store.anthropicModel, store.groqModel, store.xaiModel]);

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3000);
  };

  const loadTasks = useCallback(async () => {
    try {
      setLoading(true);
      if (window.electronAPI?.getScheduledTasks) {
        const result = await window.electronAPI.getScheduledTasks();
        setTasks(Array.isArray(result) ? result : []);
      } else {
        setTasks([]);
      }
    } catch (error) {
      console.error('[Automation] Failed to load tasks:', error);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
    // Re-load tasks when AI creates one via the scheduling modal
    const handler = () => loadTasks();
    window.addEventListener('automation-task-created', handler);
    return () => window.removeEventListener('automation-task-created', handler);
  }, [loadTasks]);

  const toggleTask = async (taskId: string) => {
    try {
      if (window.electronAPI?.toggleScheduledTask) {
        await window.electronAPI.toggleScheduledTask(taskId);
        await loadTasks();
        showFeedback('Task updated');
      }
    } catch (error) {
      console.error('Failed to toggle task:', error);
    }
  };

  const runTask = async (taskId: string) => {
    setRunningId(taskId);
    try {
      if (window.electronAPI?.runScheduledTask) {
        await window.electronAPI.runScheduledTask(taskId);
        showFeedback('Task started!');
        setTimeout(loadTasks, 1500);
      }
    } catch (error) {
      console.error('Failed to run task:', error);
    } finally {
      setRunningId(null);
    }
  };

  const deleteTask = async (taskId: string) => {
    if (!confirm('Delete this automation task?')) return;
    try {
      if (window.electronAPI?.deleteScheduledTask) {
        await window.electronAPI.deleteScheduledTask(taskId);
        await loadTasks();
        showFeedback('Task deleted');
      }
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
  };

  const openCreate = () => {
    setEditingTask(null);
    setForm({
      ...EMPTY_FORM,
      provider: store.aiProvider || 'google',
      model: store.aiProvider === 'google' ? store.geminiModel :
             store.aiProvider === 'ollama' ? store.ollamaModel :
             store.aiProvider === 'azure-openai' ? store.azureOpenaiModel :
             store.aiProvider === 'anthropic' ? store.anthropicModel :
             store.aiProvider === 'openai' ? store.openaiModel :
             store.aiProvider === 'groq' ? store.groqModel : '',
    });
    setCustomCron(false);
    setFrequency('daily');
    setHour('08');
    setMinute('00');
    setShowForm(true);
  };

  const parseCronToGui = (cron: string | undefined | null) => {
    if (!cron) return;
    const parts = cron.trim().split(/\s+/);
    if (parts.length !== 5) {
      setFrequency('custom');
      return;
    }
    const [min, h, dom, mon, dow] = parts;

    if (h.includes('*/')) {
      setFrequency('hourly');
      setHourlyInterval(h.replace('*/', ''));
    } else if (dow !== '*' && dow !== '0-6') {
      setFrequency('weekly');
      setHour(h.padStart(2, '0'));
      setMinute(min.padStart(2, '0'));
      setSelectedDays(dow.split(','));
    } else if (min !== '*' && h !== '*' && dom === '*' && mon === '*' && dow === '*') {
      setFrequency('daily');
      setHour(h.padStart(2, '0'));
      setMinute(min.padStart(2, '0'));
    } else {
      setFrequency('custom');
    }
  };

  const buildCronFromGui = () => {
    if (frequency === 'hourly') {
      return `0 */${hourlyInterval} * * *`;
    } else if (frequency === 'daily') {
      return `${parseInt(minute)} ${parseInt(hour)} * * *`;
    } else if (frequency === 'weekly') {
      const days = selectedDays.length > 0 ? selectedDays.sort().join(',') : '*';
      return `${parseInt(minute)} ${parseInt(hour)} * * ${days}`;
    }
    return form.cron;
  };

  const openEdit = (task: Task) => {
    const cron = safeCron(task);
    const isPreset = SCHEDULE_PRESETS.slice(0, -1).some(p => p.cron === cron);
    setEditingTask(task);
    setForm({
      name: task.name || '',
      description: task.description || '',
      type: task.type || 'ai-prompt',
      cron: cron,
      prompt: task.prompt || '',
      outputPath: task.outputPath || '',
      enabled: task.enabled,
      model: task.model || '',
      provider: task.provider || '',
    });
    setCustomCron(!isPreset && !!cron);
    parseCronToGui(cron);
    setShowForm(true);
  };

  const saveTask = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const finalCron = frequency === 'custom' ? form.cron : buildCronFromGui();

      const taskData = {
        name: form.name.trim(),
        description: form.description.trim(),
        type: form.type,
        schedule: finalCron,
        cronExpression: finalCron,
        prompt: form.prompt,
        outputPath: form.outputPath,
        enabled: form.enabled,
        model: form.model,
        provider: form.provider,
      };

      if (editingTask) {
        if (window.electronAPI?.updateScheduledTask) {
          await window.electronAPI.updateScheduledTask(editingTask.id, taskData);
          showFeedback('Task updated!');
        }
      } else {
        if (window.electronAPI?.scheduleTask) {
          await window.electronAPI.scheduleTask(taskData);
          showFeedback('Task created!');
        }
      }
      setShowForm(false);
      await loadTasks();
    } catch (error) {
      console.error('Failed to save task:', error);
    } finally {
      setSaving(false);
    }
  };

  const getTaskIcon = (type: string) => {
    const found = TASK_TYPES.find(t => t.value === type);
    if (found) return <span className="text-sm">{found.icon}</span>;
    return <Zap size={14} />;
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'completed': return <CheckCircle size={13} className="text-green-400" />;
      case 'failed': return <XCircle size={13} className="text-red-400" />;
      case 'running': return <AlertCircle size={13} className="text-amber-400 animate-pulse" />;
      default: return <Clock size={13} className="text-white/20" />;
    }
  };

  const filteredTasks = tasks.filter(task => {
    if (filter === 'active') return task.enabled;
    if (filter === 'paused') return !task.enabled;
    return true;
  });

  return (
    <div className="h-full flex flex-col overflow-hidden relative">
      {/* Feedback Toast */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-0 left-0 right-0 z-50 flex justify-center"
          >
            <div className="bg-green-500/20 border border-green-500/30 text-green-300 text-xs font-bold px-4 py-2 rounded-full">
              ✓ {feedback}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Zap size={18} className="text-sky-400" />
              Automation Tasks
            </h3>
            <p className="text-xs text-white/30 mt-0.5">
              {tasks.length} task{tasks.length !== 1 ? 's' : ''} · LLM-powered scheduling
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadTasks}
              className="p-2 rounded-lg bg-white/5 text-white/40 hover:text-white hover:bg-white/10 transition-all"
              title="Refresh"
            >
              <RefreshCw size={14} />
            </button>
            <button
              onClick={openCreate}
              className="px-3 py-1.5 bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5"
            >
              <Plus size={14} />
              New Task
            </button>
          </div>
        </div>

        {/* LLM hint */}
        <div className="mb-4 p-3 rounded-xl bg-sky-500/5 border border-sky-500/10 flex items-start gap-3">
          <Bot size={16} className="text-sky-400 mt-0.5 flex-shrink-0" />
          <p className="text-[11px] text-white/50 leading-relaxed">
            Ask the AI: <span className="text-sky-300 font-semibold">"Generate a daily report at 8am"</span> or <span className="text-sky-300 font-semibold">"Schedule a weekly web scrape every Monday"</span>
          </p>
        </div>

        {/* CLI activation card */}
        <div className="mb-4 p-4 rounded-2xl bg-white/[0.03] border border-white/8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                <Terminal size={18} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white uppercase tracking-wider">Terminal Control (CLI)</h4>
                <p className="text-[10px] text-white/30 uppercase font-bold tracking-widest mt-0.5">Native Command Line Interface</p>
              </div>
            </div>
            <button
              onClick={async () => {
                try {
                  const result = await window.electronAPI.enableCLI();
                  if (result.success) {
                    showFeedback(result.message || 'CLI enabled');
                  } else {
                    alert('Failed to enable CLI: ' + result.error);
                  }
                } catch (e) {
                  console.error(e);
                }
              }}
              className="px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-[10px] font-black uppercase tracking-widest rounded-xl border border-amber-500/20 transition-all"
            >
              Enable CLI
            </button>
          </div>
          <div className="mt-3 p-3 rounded-xl bg-black/40 border border-white/5 space-y-2">
            <p className="text-[10px] text-white/40 leading-relaxed font-bold uppercase tracking-wide">
              Access Comet-AI from your terminal using the <span className="text-amber-400">comet</span> command.
            </p>
            <div className="flex items-center gap-2 text-[10px] text-amber-400/60 font-mono">
              <span className="opacity-40">$</span> comet ask "Summarize this page"
            </div>
          </div>
        </div>

        {/* Background Service card */}
        <div className="mb-4 p-4 rounded-2xl bg-white/[0.03] border border-white/8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
                <Bot size={18} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white uppercase tracking-wider">Background Automation</h4>
                <p className="text-[10px] text-white/30 uppercase font-bold tracking-widest mt-0.5">macOS LaunchDaemon / Windows Task</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border ${serviceRunning ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-white/5 text-white/30 border-white/10'}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${serviceRunning ? 'bg-emerald-400 animate-pulse' : 'bg-white/20'}`} />
                <span className="text-[9px] font-black uppercase tracking-widest">{serviceRunning ? 'Active' : 'Inactive'}</span>
              </div>
              <button
                onClick={async () => {
                  try {
                    const result = serviceRunning 
                      ? await window.electronAPI.uninstallService({ userMode: false })
                      : await window.electronAPI.installService({ userMode: false });
                    
                    if (result.success) {
                      showFeedback(result.message || 'Action successful');
                      // Refresh status
                      const status = await window.electronAPI.getServiceStatus();
                      setServiceRunning(status.running);
                    } else {
                      alert('Failed: ' + result.error);
                    }
                  } catch (e) {
                    console.error(e);
                  }
                }}
                className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl border transition-all ${
                  serviceRunning 
                    ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/20' 
                    : 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border-blue-500/20'
                }`}
              >
                {serviceRunning ? 'Disable' : 'Enable'}
              </button>
            </div>
          </div>
          <div className="mt-3 p-3 rounded-xl bg-black/40 border border-white/5">
            <p className="text-[10px] text-white/40 leading-relaxed font-bold uppercase tracking-wide">
              Run scheduled tasks even when Comet-AI is closed. Integrates with system-level services for maximum reliability.
            </p>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 p-1 bg-black/40 rounded-xl border border-white/5 mb-4">
          {(['all', 'active', 'paused'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all capitalize ${filter === f
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/20'
                : 'text-white/30 hover:text-white/60'}`}
            >
              {f === 'all' ? `All (${tasks.length})` :
               f === 'active' ? `Active (${tasks.filter(t => t.enabled).length})` :
               `Paused (${tasks.filter(t => !t.enabled).length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Task List */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-7 h-7 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-12 text-white/30">
          <CalendarDays size={40} className="mb-3 opacity-30" />
          <p className="text-sm font-medium">No tasks {filter !== 'all' ? `(${filter})` : 'yet'}</p>
          <p className="text-xs text-white/20 mt-1 text-center">
            Create one manually or ask the AI to schedule something
          </p>
          {filter !== 'all' && (
            <button onClick={() => setFilter('all')} className="mt-3 text-xs text-sky-400 hover:text-sky-300">
              Show all tasks
            </button>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto min-h-0 space-y-2 pr-1">
          <AnimatePresence initial={false}>
            {filteredTasks.map((task) => (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className={`p-4 rounded-xl border transition-all ${
                  task.enabled
                    ? 'bg-white/[0.03] border-white/8 hover:border-white/15'
                    : 'bg-black/20 border-white/4 opacity-55'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg flex-shrink-0 ${task.enabled ? 'bg-sky-500/10 text-sky-400' : 'bg-white/5 text-white/30'}`}>
                    {getTaskIcon(task.type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h4 className="font-semibold text-white text-sm truncate">{task.name}</h4>
                      {getStatusIcon(task.status)}
                    </div>
                    {task.description && (
                      <p className="text-[11px] text-white/35 truncate mb-1">{task.description}</p>
                    )}
                    <div className="flex items-center gap-3 text-[10px] text-white/25 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Clock size={10} />
                        {formatSchedule(safeCron(task))}
                      </span>
                      {task.lastRun && (
                        <span>Last: {new Date(task.lastRun).toLocaleDateString()}</span>
                      )}
                      {task.nextRun && task.enabled && (
                        <span className="text-sky-400/60">Next: {new Date(task.nextRun).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => runTask(task.id)}
                      disabled={runningId === task.id}
                      className="p-1.5 rounded-lg bg-white/5 text-white/40 hover:text-green-400 hover:bg-green-400/10 transition-all disabled:opacity-40"
                      title="Run Now"
                    >
                      {runningId === task.id
                        ? <RefreshCw size={13} className="animate-spin" />
                        : <Play size={13} />}
                    </button>
                    <button
                      onClick={() => openEdit(task)}
                      className="p-1.5 rounded-lg bg-white/5 text-white/40 hover:text-sky-400 hover:bg-sky-400/10 transition-all"
                      title="Edit"
                    >
                      <Edit3 size={13} />
                    </button>
                    <button
                      onClick={() => toggleTask(task.id)}
                      className={`p-1.5 rounded-lg transition-all ${task.enabled
                        ? 'bg-white/5 text-white/40 hover:text-amber-400 hover:bg-amber-400/10'
                        : 'bg-sky-500/10 text-sky-400 hover:bg-sky-500/20'}`}
                      title={task.enabled ? 'Pause' : 'Enable'}
                    >
                      {task.enabled ? <Pause size={13} /> : <Play size={13} />}
                    </button>
                    <button
                      onClick={() => deleteTask(task.id)}
                      className="p-1.5 rounded-lg bg-white/5 text-white/40 hover:text-red-400 hover:bg-red-400/10 transition-all"
                      title="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[2000] flex items-center justify-center bg-[#020208]/95 backdrop-blur-md p-6"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="w-full max-w-xl bg-[#0a0a14] border border-white/[0.08] rounded-[2rem] shadow-[0_32px_80px_rgba(0,0,0,0.8)] overflow-hidden"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-8 py-5 border-b border-white/[0.04] bg-white/[0.01]">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400">
                    <Zap size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white uppercase tracking-wider">
                      {editingTask ? 'Edit Automation' : 'New Automation'}
                    </h3>
                    <p className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] mt-0.5">Configure Neural Trigger</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowForm(false)}
                  className="p-2 rounded-xl hover:bg-white/5 text-white/20 hover:text-white transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-8 space-y-6 max-h-[75vh] overflow-y-auto custom-scrollbar">
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Left Column */}
                  <div className="space-y-6">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-[0.25em] text-white/25 mb-2 block">
                        Identity
                      </label>
                      <input
                        value={form.name}
                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                        placeholder="Task name (e.g. Daily Brief)"
                        className="w-full bg-white/[0.03] border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-sky-400/40 transition-all font-bold"
                      />
                      <input
                        value={form.description}
                        onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                        placeholder="Brief description (optional)"
                        className="w-full bg-white/[0.03] border border-white/8 rounded-xl px-4 py-2.5 text-[11px] text-white/40 placeholder-white/10 outline-none focus:border-sky-400/40 transition-all mt-2"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-black uppercase tracking-[0.25em] text-white/25 mb-2 block">
                        Objective
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {TASK_TYPES.map(t => (
                          <button
                            key={t.value}
                            onClick={() => setForm(f => ({ ...f, type: t.value }))}
                            className={`px-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-left flex items-center gap-2.5 ${
                              form.type === t.value
                                ? 'bg-sky-500/20 border border-sky-500/30 text-sky-300 shadow-[0_8px_20px_rgba(56,189,248,0.2)]'
                                : 'bg-white/5 border border-white/4 text-white/30 hover:border-white/12 hover:text-white/60'
                            }`}
                          >
                            <span className="opacity-70">{t.icon}</span> {t.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Model/Provider selection */}
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-[0.25em] text-white/25 mb-2 block">
                        Intelligence Module
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={form.provider}
                          onChange={e => setForm(f => ({ ...f, provider: e.target.value }))}
                          className="w-full bg-white/[0.03] border border-white/8 rounded-xl px-3 py-2.5 text-[11px] font-bold text-white outline-none focus:border-sky-400/40 transition-all"
                        >
                          <option value="google" className="bg-[#0a0a14]">Google Gemini</option>
                          <option value="ollama" className="bg-[#0a0a14]">Local Ollama</option>
                          <option value="anthropic" className="bg-[#0a0a14]">Anthropic</option>
                          <option value="openai" className="bg-[#0a0a14]">OpenAI</option>
                          <option value="azure-openai" className="bg-[#0a0a14]">Microsoft Azure OpenAI</option>
                          <option value="groq" className="bg-[#0a0a14]">Groq</option>
                        </select>
                        <input
                          value={form.model}
                          onChange={e => setForm(f => ({ ...f, model: e.target.value }))}
                          placeholder="Model (e.g. flash)"
                          className="w-full bg-white/[0.03] border border-white/8 rounded-xl px-3 py-2.5 text-[11px] font-bold text-sky-400 placeholder-white/20 outline-none focus:border-sky-400/40 transition-all font-mono"
                        />
                      </div>
                      <p className="text-[9px] text-white/15 mt-1.5 px-1">
                        AI will use this platform for execution. Recommended: <span className="text-emerald-400/50">Gemini 3.1 Pro</span>
                      </p>
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-6">
                    {/* Prompt (Moved up) */}
                    {(form.type === 'ai-prompt' || form.type === 'pdf-generate' || form.type === 'daily-brief') && (
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-[0.25em] text-white/25 mb-2 block">
                          Goal Directive
                        </label>
                        <textarea
                          value={form.prompt}
                          onChange={e => setForm(f => ({ ...f, prompt: e.target.value }))}
                          placeholder="e.g. Scrape the latest price of Bitcoin and send a notification"
                          rows={4}
                          className="w-full bg-white/[0.03] border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-sky-400/40 transition-all resize-none font-medium leading-relaxed"
                        />
                      </div>
                    )}

                    {/* GUI Cron Builder */}
                    <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-4">
                      <label className="text-[10px] font-black uppercase tracking-[0.25em] text-white/25 block">
                        Schedule Configuration
                      </label>

                      {/* Frequency Selection */}
                      <div className="flex gap-1 p-1 bg-black/40 rounded-xl border border-white/5">
                        {FREQUENCIES.map(f => (
                          <button
                            key={f.value}
                            onClick={() => setFrequency(f.value)}
                            className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                              frequency === f.value ? 'bg-sky-500/20 text-sky-300' : 'text-white/20 hover:text-white/40'
                            }`}
                          >
                            {f.label}
                          </button>
                        ))}
                      </div>

                      {/* Hourly UI */}
                      {frequency === 'hourly' && (
                        <div className="flex items-center gap-3">
                          <span className="text-[11px] text-white/40 font-bold uppercase">Every</span>
                          <select
                            value={hourlyInterval}
                            onChange={e => setHourlyInterval(e.target.value)}
                            className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-sky-400 font-bold outline-none"
                          >
                            {[1, 2, 3, 4, 6, 8, 12].map(n => (
                              <option key={n} value={n.toString()} className="bg-[#0a0a14]">{n}</option>
                            ))}
                          </select>
                          <span className="text-[11px] text-white/40 font-bold uppercase">Hour(s)</span>
                        </div>
                      )}

                      {/* Daily/Weekly Time UI */}
                      {(frequency === 'daily' || frequency === 'weekly') && (
                        <div className="flex flex-col gap-4">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-white/40 font-bold uppercase">At</span>
                            <div className="flex items-center gap-1">
                              <select value={hour} onChange={e => setHour(e.target.value)} className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-sky-400 font-bold outline-none">
                                {Array.from({ length: 24 }).map((_, i) => <option key={i} value={i.toString().padStart(2, '0')} className="bg-[#0a0a14]">{i.toString().padStart(2, '0')}</option>)}
                              </select>
                              <span className="text-white/20">:</span>
                              <select value={minute} onChange={e => setMinute(e.target.value)} className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-sky-400 font-bold outline-none">
                                {['00', '15', '30', '45'].map(m => <option key={m} value={m} className="bg-[#0a0a14]">{m}</option>)}
                              </select>
                            </div>
                          </div>

                          {frequency === 'weekly' && (
                            <div className="flex flex-wrap gap-1.5">
                              {DAYS_OF_WEEK.map(d => (
                                <button
                                  key={d.value}
                                  onClick={() => setSelectedDays(prev => prev.includes(d.value) ? prev.filter(x => x !== d.value) : [...prev, d.value])}
                                  className={`px-2 py-1.5 rounded-lg text-[9px] font-bold uppercase transition-all ${
                                    selectedDays.includes(d.value) ? 'bg-sky-500/20 text-sky-300 border border-sky-500/20' : 'bg-white/5 text-white/20'
                                  }`}
                                >
                                  {d.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Custom Cron UI */}
                      {frequency === 'custom' && (
                        <input
                          value={form.cron}
                          onChange={e => setForm(f => ({ ...f, cron: e.target.value }))}
                          placeholder="Cron expression (e.g. 0 8 * * *)"
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-mono text-sky-300 placeholder-white/20 outline-none"
                        />
                      )}

                      <div className="flex items-center gap-2 px-1">
                        <Clock size={12} className="text-white/20" />
                        <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">
                          Next Execution: <span className="text-sky-400/60 font-mono lowercase tracking-normal">
                            {formatSchedule(frequency === 'custom' ? form.cron : buildCronFromGui())}
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="h-px bg-white/[0.04] w-full" />

                {/* Bottom Row */}
                <div className="grid md:grid-cols-2 gap-8 items-center pt-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-violet-500/10 text-violet-400">
                      <FolderOpen size={18} />
                    </div>
                    <div className="flex-1">
                      <label className="text-[10px] font-black uppercase tracking-[0.25em] text-white/25 mb-1 block">Output Location</label>
                      <input
                        value={form.outputPath}
                        onChange={e => setForm(f => ({ ...f, outputPath: e.target.value }))}
                        placeholder="~/Documents/Comet-AI/"
                        className="w-full bg-white/[0.03] border border-white/8 rounded-xl px-4 py-2.5 text-xs text-white/60 placeholder-white/10 outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/4">
                    <div className="flex items-center gap-3">
                      <Activity size={18} className="text-emerald-400" />
                      <div>
                        <span className="text-[11px] font-black text-white uppercase tracking-wider block">Auto-Enable</span>
                        <span className="text-[9px] text-white/20 uppercase font-bold">Start task on save</span>
                      </div>
                    </div>
                    <button
                      onClick={() => setForm(f => ({ ...f, enabled: !f.enabled }))}
                      className={`transition-all duration-500 ${form.enabled ? 'text-emerald-400 scale-110' : 'text-white/10'}`}
                    >
                      {form.enabled ? <ToggleRight size={36} /> : <ToggleLeft size={36} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex gap-4 px-8 py-6 border-t border-white/[0.04] bg-white/[0.01]">
                <button
                  onClick={() => setShowForm(false)}
                  className="flex-1 py-4 rounded-2xl bg-white/5 border border-white/8 text-[11px] font-black uppercase tracking-[0.3em] text-white/30 hover:text-white hover:bg-white/10 transition-all"
                >
                  Discard
                </button>
                <button
                  onClick={saveTask}
                  disabled={saving || !form.name.trim()}
                  className="flex-1 py-4 rounded-2xl bg-sky-500 hover:bg-sky-400 text-white text-[11px] font-black uppercase tracking-[0.3em] transition-all disabled:opacity-40 shadow-[0_12px_40px_rgba(56,189,248,0.3)] flex items-center justify-center gap-3"
                >
                  {saving ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <Save size={14} />
                  )}
                  {editingTask ? 'Commit Changes' : 'Initialize Task'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AutomationSettings;
