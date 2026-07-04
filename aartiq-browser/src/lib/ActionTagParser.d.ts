export interface ActionTag {
  type: string;
  category: 'system' | 'automation' | 'navigation' | 'utility';
  value: string;
  timestamp?: number;
}
