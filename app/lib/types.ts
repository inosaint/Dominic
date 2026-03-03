// Shared types for the Next.js UI app

export interface SelectionInfo {
  id: string;
  name: string;
  type: string;
  width: number;
  height: number;
  childCount: number;
  thumbnail?: string;
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
  enableAgentChat?: boolean;
  designSystemCache?: boolean;
}

export interface DesignSystemCacheData {
  cache: DesignSystemCache;
  promptContext: string;
}

export interface DesignSystemCache {
  colors: {
    fills: Record<string, { count: number; token?: string }>;
    strokes: Record<string, { count: number; token?: string }>;
  };
  typography: Array<{
    family: string;
    size: number;
    weight: number;
    lineHeight?: number;
    count: number;
  }>;
  spacing: {
    padding: Record<string, number>;
    gap: Record<string, number>;
  };
  radii: Record<string, number>;
  effects: Record<string, number>;
  components: Array<{ name: string; instances: number }>;
  scannedAt: number;
  nodeCount: number;
  pageId: string;
  pageName: string;
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

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
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
  conversationHistory?: ConversationTurn[];
  chatMode?: boolean;
}

export interface ReviewResponse {
  items: ReviewItem[];
  text?: string;
  error?: string;
}

export interface ObserverHint {
  type: 'color' | 'spacing' | 'typography' | 'radius';
  message: string;
}

export interface ObserverFix {
  id: string;
  type: 'color' | 'spacing' | 'typography' | 'radius';
  nodeId: string;
  nodeName: string;
  property: string;
  currentValue: string;
  suggestedValue: string;
  fixData: object;
}

export interface ObserverHints {
  frameName: string;
  frameId: string;
  hints: ObserverHint[];
  fixes?: ObserverFix[];
}
