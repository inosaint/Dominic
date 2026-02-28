// Shared types for the Next.js UI app

export interface SelectionInfo {
  id: string;
  name: string;
  type: string;
  width: number;
  height: number;
  childCount: number;
}

export interface ReviewItem {
  nodeId: string;
  feedback: string;
  category:
    | 'spacing'
    | 'typography'
    | 'color'
    | 'hierarchy'
    | 'accessibility'
    | 'layout'
    | 'consistency'
    | 'interaction'
    | 'i18n'
    | 'tokens'
    | 'general';
  severity: 'suggestion' | 'warning' | 'issue';
}

export type OutputMode = 'annotations' | 'sticky-notes' | 'both';

export interface CustomAgentConfig {
  id: string;
  name: string;
  emoji: string;
  subtitle: string;
  systemPrompt: string;
}

export interface Settings {
  provider: 'anthropic' | 'openai';
  apiKey: string;
  model: string;
  includeScreenshot: boolean;
  autoClearPrevious: boolean;
  outputMode: OutputMode;
  customAgents?: CustomAgentConfig[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  reviewItems?: ReviewItem[];
  annotationResult?: { written: number; skipped: number; annotationsSupported: boolean };
  timestamp: number;
  agentId?: string;
  agentName?: string;
  agentEmoji?: string;
}

export interface ReviewRequest {
  designData: object;
  screenshot?: string;
  userPrompt: string;
  provider: 'anthropic' | 'openai';
  apiKey: string;
  model: string;
  agentId?: string;
  agentSystemPrompt?: string;
}

export interface ReviewResponse {
  items: ReviewItem[];
  error?: string;
}
