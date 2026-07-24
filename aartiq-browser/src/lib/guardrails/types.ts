export const ThreatType = {
  PROMPT_INJECTION: 'prompt_injection',
  PII_LEAK: 'pii_leak',
  DANGEROUS_COMMAND: 'dangerous_command',
  ENCODED_PAYLOAD: 'encoded_payload',
  ZERO_WIDTH_CHAR: 'zero_width_char',
  SUSPICIOUS_URL: 'suspicious_url',
  CROSS_SITE_SCRIPT: 'cross_site_script',
  DATA_EXFILTRATION: 'data_exfiltration',
} as const;

export type ThreatType = (typeof ThreatType)[keyof typeof ThreatType];

export type GuardrailMode = 'normal' | 'strict';

export interface ThreatMatch {
  type: ThreatType;
  pattern: string;
  start: number;
  end: number;
}

export interface SanitizationResult {
  sanitized: string;
  threats: ThreatMatch[];
  mode: GuardrailMode;
  normalized: boolean;
}
