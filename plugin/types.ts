// Shared types between plugin code and UI

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

export interface Settings {
  provider: 'anthropic' | 'openai';
  apiKey: string;
  model: string;
  includeScreenshot: boolean;
  autoClearPrevious: boolean;
  outputMode: OutputMode;
}

// iframe → Plugin messages
export type UIToPluginMessage =
  | { type: 'GET_SELECTION' }
  | { type: 'RUN_REVIEW'; payload: { prompt: string; includeScreenshot: boolean } }
  | { type: 'WRITE_ANNOTATIONS'; payload: { reviewItems: ReviewItem[] } }
  | { type: 'CLEAR_ANNOTATIONS' }
  | { type: 'STORE_SETTINGS'; payload: Settings }
  | { type: 'GET_SETTINGS' }
  | { type: 'FOCUS_NODE'; payload: { nodeId: string } }
  | { type: 'DISMISS_REVIEW_ITEM'; payload: { index: number } }
  | { type: 'SCAN_DESIGN_SYSTEM' }
  | { type: 'GET_DESIGN_SYSTEM_CACHE' };

// Plugin → iframe messages
export type PluginToUIMessage =
  | { type: 'SELECTION_DATA'; payload: SelectionInfo | null }
  | { type: 'DESIGN_DATA_READY'; payload: { json: object; screenshot?: string } }
  | { type: 'ANNOTATIONS_WRITTEN'; payload: { written: number; skipped: number; annotationsSupported: boolean } }
  | { type: 'STICKY_NOTES_WRITTEN'; payload: { created: number } }
  | { type: 'ANNOTATIONS_CLEARED' }
  | { type: 'SETTINGS_LOADED'; payload: Settings }
  | { type: 'MARKER_SELECTED'; payload: { index: number; nodeId: string } }
  | { type: 'ITEM_DISMISSED'; payload: { index: number } }
  | { type: 'DESIGN_SYSTEM_SCANNED'; payload: { cache: object; promptContext: string } }
  | { type: 'DESIGN_SYSTEM_CACHE_LOADED'; payload: { cache: object; promptContext: string } | null }
  | { type: 'ERROR'; payload: { message: string } };
