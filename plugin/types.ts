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
    | 'general';
  severity: 'suggestion' | 'warning' | 'issue';
}

export interface Settings {
  provider: 'anthropic' | 'openai';
  apiKey: string;
  model: string;
  includeScreenshot: boolean;
  autoClearPrevious: boolean;
}

// iframe → Plugin messages
export type UIToPluginMessage =
  | { type: 'GET_SELECTION' }
  | { type: 'RUN_REVIEW'; payload: { prompt: string; includeScreenshot: boolean } }
  | { type: 'WRITE_ANNOTATIONS'; payload: { reviewItems: ReviewItem[] } }
  | { type: 'CLEAR_ANNOTATIONS' }
  | { type: 'STORE_SETTINGS'; payload: Settings }
  | { type: 'GET_SETTINGS' };

// Plugin → iframe messages
export type PluginToUIMessage =
  | { type: 'SELECTION_DATA'; payload: SelectionInfo | null }
  | { type: 'DESIGN_DATA_READY'; payload: { json: object; screenshot?: string } }
  | { type: 'ANNOTATIONS_WRITTEN'; payload: { written: number; skipped: number; annotationsSupported: boolean } }
  | { type: 'ANNOTATIONS_CLEARED' }
  | { type: 'SETTINGS_LOADED'; payload: Settings }
  | { type: 'ERROR'; payload: { message: string } };
