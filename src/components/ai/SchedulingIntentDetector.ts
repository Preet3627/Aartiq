/**
 * Scheduling Intent Detection
 * 
 * Detects when a user wants to schedule an automated task.
 * Supports natural language patterns like "at 8am", "every day", etc.
 */

export interface SchedulingIntent {
  detected: boolean;
  confidence: 'high' | 'medium' | 'low';
  taskName: string;
  taskType: 'ai-prompt' | 'web-scrape' | 'pdf-generate' | 'workflow' | 'daily-brief' | 'shell' | 'open-url';
  schedule: {
    type: 'cron' | 'once' | 'interval';
    expression: string;
    description: string;
  };
  timezone: string;
  outputPath?: string;
  url?: string;
  command?: string;
  model?: {
    provider: string;
    model: string;
  };
}

// Type for extracted scheduling data
type ExtractedData = RegExpMatchArray | { hour: number; minute: number; period: string; [key: string]: any };

// Scheduling patterns to detect
const SCHEDULING_PATTERNS = [
  // Time-based patterns
  { 
    regex: /\b(at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/gi,
    extract: (match: RegExpMatchArray) => {
      let hour = parseInt(match[2]);
      const minute = parseInt(match[3] || '0');
      const period = match[4].toLowerCase();
      if (period === 'pm' && hour !== 12) hour += 12;
      if (period === 'am' && hour === 12) hour = 0;
      return { hour, minute, period: match[4] };
    },
    toCron: (extracted: ExtractedData) => {
      if (!('hour' in extracted)) return '';
      return `${extracted.minute} ${extracted.hour} * * *`;
    },
    description: (extracted: ExtractedData) => {
      if (!('hour' in extracted)) return '';
      return `at ${extracted.hour.toString().padStart(2, '0')}:${extracted.minute.toString().padStart(2, '0')} ${extracted.period.toUpperCase()}`;
    }
  },
  
  // Daily patterns
  { 
    regex: /\b(daily|every\s+day|everyday)\b/gi,
    toCron: () => '0 8 * * *',
    description: () => 'daily at 8:00 AM'
  },
  
  // Weekly patterns
  { 
    regex: /\b(every|each)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi,
    daysMap: { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 },
    toCron: (extracted: ExtractedData, pattern: any) => {
      const match = extracted as RegExpMatchArray;
      const day = pattern.daysMap[match[2].toLowerCase()];
      return `0 9 ${day} * *`;
    },
    description: (extracted: ExtractedData) => {
      const match = extracted as RegExpMatchArray;
      return `every ${match[2]}`;
    }
  },
  
  // Weekdays patterns
  { 
    regex: /\b(weekdays?|business\s+days?)\b/gi,
    toCron: () => '0 9 * * 1-5',
    description: () => 'weekdays at 9:00 AM'
  },
  
  // Hourly patterns
  { 
    regex: /\b(every|each)\s+hour/gi,
    toCron: () => '0 * * * *',
    description: () => 'every hour'
  },
  
  // Interval patterns
  { 
    regex: /\bevery\s+(\d+)\s+(minutes?|hours?)\b/gi,
    toCron: (extracted: ExtractedData) => {
      const match = extracted as RegExpMatchArray;
      const value = parseInt(match[1]);
      const unit = match[2].toLowerCase();
      if (unit.startsWith('hour')) return `0 */${value} * * *`;
      return `*/${value} * * * *`;
    },
    description: (extracted: ExtractedData) => {
      const match = extracted as RegExpMatchArray;
      return `every ${match[1]} ${match[2]}`;
    }
  },
  
  // "Tomorrow" pattern
  { 
    regex: /\btomorrow\s+(at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/gi,
    toCron: (extracted: ExtractedData) => {
      const match = extracted as RegExpMatchArray;
      const hour = parseInt(match[2]);
      const minute = parseInt(match[3] || '0');
      const period = (match[4] || 'am').toLowerCase();
      let h = hour;
      if (period === 'pm' && hour !== 12) h += 12;
      if (period === 'am' && hour === 12) h = 0;
      return `${minute} ${h} * * *`;
    },
    description: (extracted: ExtractedData) => {
      const match = extracted as RegExpMatchArray;
      return `tomorrow at ${match[2]}:${(match[3] || '00').padStart(2, '0')} ${(match[4] || 'AM').toUpperCase()}`;
    }
  },
  
  // "In X hours" pattern
  { 
    regex: /\bin\s+(\d+)\s+(hours?|minutes?)\b/gi,
    toCron: () => '',
    description: (extracted: ExtractedData) => {
      const match = extracted as RegExpMatchArray;
      return `in ${match[1]} ${match[2]}`;
    }
  },
  
  // "First of month" pattern
  { 
    regex: /\b(first\s+day|first\s+of\s+(each\s+)?month|monthly)\b/gi,
    toCron: () => '0 8 1 * *',
    description: () => 'first day of month at 8:00 AM'
  },
];

// Task type detection patterns
const TASK_TYPE_PATTERNS = {
  'pdf-generate': [
    /\b(generate|create|make)\s+(a\s+)?pdf\b/gi,
    /\bpdf\s+report\b/gi,
    /\bsave\s+.*\s+as\s+pdf\b/gi,
    /\bdaily\s+(news|newsletter)\b/gi,
    /\bweekly\s+report\b/gi,
  ],
  'web-scrape': [
    /\b(scrape|fetch|get)\s+(news|data|prices?|content)\s+from\b/gi,
    /\bcheck\s+(prices?|stock|availability)\b/gi,
    /\bmonitor\s+\w+\b/gi,
  ],
  'daily-brief': [
    /\b(morning|daily)\s+(briefing|summary|update)\b/gi,
    /\bnews\s+summary\b/gi,
    /\bdaily\s+briefing\b/gi,
  ],
  'ai-prompt': [
    /\b(ask|tell|remind)\s+me\b/gi,
    /\bsummarize\b/gi,
  ],
  'workflow': [
    /\bautomate\s+\w+\b/gi,
    /\bevery\s+(monday|tuesday|...)\s+at\b/gi,
  ],
};

// Output path patterns
const OUTPUT_PATTERNS = [
  { regex: /\bdesktop\b/gi, path: '~/Desktop' },
  { regex: /\bdownloads?\b/gi, path: '~/Downloads' },
  { regex: /\bdocuments?\b/gi, path: '~/Documents' },
  { regex: /\bdocuments\/aartiq\b/gi, path: '~/Documents/Aartiq' },
];

/**
 * Detect if the message contains scheduling intent
 */
export function detectSchedulingIntent(message: string): SchedulingIntent | null {
  const lowerMessage = message.toLowerCase();
  
  // Check if message contains scheduling keywords
  const scheduleKeywords = [
    'schedule', 'scheduled', 'scheduling',
    'at', 'every', 'daily', 'weekly', 'monthly',
    'tomorrow', 'every day', 'recurring', 'repeat',
    'cron', 'automate', 'automated'
  ];
  
  const hasScheduleKeyword = scheduleKeywords.some(keyword => 
    lowerMessage.includes(keyword.toLowerCase())
  );
  
  if (!hasScheduleKeyword) {
    return null;
  }
  
  // Extract schedule information
  let scheduleInfo: {
    type: 'cron' | 'once' | 'interval';
    expression: string;
    description: string;
  } | null = null;
  
  let confidence: 'high' | 'medium' | 'low' = 'low';
  
  for (const pattern of SCHEDULING_PATTERNS) {
    const matches = message.matchAll(pattern.regex);
    for (const match of matches) {
      if (pattern.toCron) {
        const extracted = pattern.extract ? pattern.extract(match) : match;
        const cronExpr = pattern.toCron(extracted, pattern);
        const desc = pattern.description ? pattern.description(extracted) : cronExpr;
        
        if (cronExpr) {
          const newSpec = cronExpr.split(' ').filter(p => p !== '*').length;
          const curSpec = scheduleInfo ? scheduleInfo.expression.split(' ').filter(p => p !== '*').length : 0;
          if (!scheduleInfo || newSpec > curSpec) {
            scheduleInfo = {
              type: 'cron',
              expression: cronExpr,
              description: desc
            };
            confidence = 'high';
          }
        }
      }
    }
  }
  
  // If no schedule found with patterns, check for simple "at X" which might be today
  if (!scheduleInfo) {
    const simpleTimeMatch = message.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
    if (simpleTimeMatch) {
      let hour = parseInt(simpleTimeMatch[1]);
      const minute = parseInt(simpleTimeMatch[2] || '0');
      const period = simpleTimeMatch[3].toLowerCase();
      if (period === 'pm' && hour !== 12) hour += 12;
      
      scheduleInfo = {
        type: 'cron',
        expression: `${minute} ${hour} * * *`,
        description: `daily at ${hour}:${minute.toString().padStart(2, '0')} ${period.toUpperCase()}`
      };
      confidence = 'medium';
    }
  }
  
  if (!scheduleInfo) {
    return null;
  }
  
  // Detect task type
  let taskType: SchedulingIntent['taskType'] = 'ai-prompt';
  for (const [type, patterns] of Object.entries(TASK_TYPE_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(message)) {
        taskType = type as SchedulingIntent['taskType'];
        break;
      }
    }
  }
  
  // Extract task name
  const taskName = extractTaskName(message);
  
  // Detect output path
  let outputPath = '~/Documents/Aartiq';
  for (const pattern of OUTPUT_PATTERNS) {
    if (pattern.regex.test(message)) {
      outputPath = pattern.path;
      break;
    }
  }
  
  // Detect timezone (default to user's timezone)
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  
  return {
    detected: true,
    confidence,
    taskName,
    taskType,
    schedule: scheduleInfo!,
    timezone,
    outputPath
  };
}

/**
 * Extract a readable task name from the message
 */
function extractTaskName(message: string): string {
  // Remove scheduling-related words
  let name = message
    .replace(/\b(schedule|scheduled|at\s+|every\s+|daily|weekly|monthly|please|can you|could you|generate|create|make)\b/gi, '')
    .replace(/\b\d{1,2}(?::\d{2})?\s*(am|pm)\b/gi, '')
    .replace(/\bin\s+\d+\s+(hours?|minutes?)\b/gi, '')
    .replace(/\btomorrow\b/gi, '')
    .trim();
  
  // Truncate if too long
  if (name.length > 50) {
    name = name.substring(0, 47) + '...';
  }
  
  // Capitalize first letter
  name = name.charAt(0).toUpperCase() + name.slice(1);
  
  return name || 'Scheduled Task';
}

/**
 * Format cron expression to human readable
 */
export function formatCronExpression(expression: string): string {
  const parts = expression.split(' ');
  if (parts.length !== 5) return expression;
  
  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
  
  // Daily
  if (dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    const h = parseInt(hour).toString().padStart(2, '0');
    const m = minute.startsWith('*/') ? 'every ' + minute.substring(2) + 'min' : minute.padStart(2, '0');
    return `Daily at ${h}:${m}`;
  }
  
  // Weekdays
  if (dayOfWeek === '1-5') {
    const h = hour.padStart(2, '0');
    return `Weekdays at ${h}:${minute.padStart(2, '0')}`;
  }
  
  // Weekly
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayIndex = parseInt(dayOfWeek);
  if (!isNaN(dayIndex) && dayIndex >= 0 && dayIndex <= 6) {
    return `Every ${days[dayIndex]} at ${hour}:${minute.padStart(2, '0')}`;
  }
  
  // Hourly
  if (hour === '*' && dayOfMonth === '*') {
    return `Every ${minute.substring(2) || minute} minutes`;
  }
  
  return expression;
}

/**
 * Parse cron expression to get next run time
 */
export function getNextRunTime(expression: string): Date | null {
  try {
    const parts = expression.split(' ');
    if (parts.length !== 5) return null;
    
    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
    const now = new Date();
    const next = new Date(now);
    
    // Set hour and minute
    next.setHours(parseInt(hour) || 0);
    next.setMinutes(parseInt(minute.startsWith('*/') ? minute.substring(2) : minute) || 0);
    next.setSeconds(0);
    next.setMilliseconds(0);
    
    // If time has passed today, move to next occurrence
    if (next <= now) {
      if (dayOfWeek === '*' && dayOfMonth === '*') {
        next.setDate(next.getDate() + 1);
      } else if (dayOfWeek !== '*') {
        next.setDate(next.getDate() + 1);
      }
    }
    
    return next;
  } catch {
    return null;
  }
}

/**
 * Common schedule presets
 */
export const SCHEDULE_PRESETS = [
  { label: 'Daily at 8:00 AM', cron: '0 8 * * *', description: 'Every day at 8 AM' },
  { label: 'Daily at 6:00 PM', cron: '0 18 * * *', description: 'Every day at 6 PM' },
  { label: 'Weekdays at 9:00 AM', cron: '0 9 * * 1-5', description: 'Monday to Friday at 9 AM' },
  { label: 'Every hour', cron: '0 * * * *', description: 'Every hour on the hour' },
  { label: 'Every 30 minutes', cron: '*/30 * * * *', description: 'Every half hour' },
  { label: 'Every Monday at 9:00 AM', cron: '0 9 * * 1', description: 'Every Monday at 9 AM' },
  { label: 'First day of month at 8:00 AM', cron: '0 8 1 * *', description: '1st of every month' },
  { label: 'Twice daily (8 AM & 8 PM)', cron: '0 8,20 * * *', description: 'Every 12 hours' },
];
