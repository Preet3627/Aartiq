export interface ShellCommand {
  command: string;
  args: string[];
  riskLevel: 'low' | 'medium' | 'high';
  safe: boolean;
  requiresPermission: boolean;
}
