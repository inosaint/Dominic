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
    | 'general';
  severity: 'suggestion' | 'warning' | 'issue';
}

export type OutputMode = 'annotations' | 'sticky-notes' | 'both';

export interface Settings {
  provider: 'anthropic' | 'openai';
  apiKey: string;
  model: string;
  includeScreenshot: boolean;
  autoClearPrevious: boolean;
  outputMode: OutputMode;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  reviewItems?: ReviewItem[];
  annotationResult?: { written: number; skipped: number; annotationsSupported: boolean };
  timestamp: number;
}

export interface ReviewRequest {
  designData: object;
  screenshot?: string;
  userPrompt: string;
  provider: 'anthropic' | 'openai';
  apiKey: string;
  model: string;
}

export interface ReviewResponse {
  items: ReviewItem[];
  error?: string;
}
