// Pair Designer — Figma Plugin Sandbox Code
// This runs in Figma's plugin sandbox (no DOM access)

import { UIToPluginMessage, Settings } from './types';
import { getDesignData, countDescendants } from './extractDesignData';
import {
  getOrCreateAIReviewCategory,
  writeAnnotations,
  clearAIAnnotations,
} from './annotationWriter';
import { writeStickyNotes, clearStickyNotes, dismissReviewItem } from './stickyNoteWriter';
import {
  scanDesignSystem,
  cacheToPromptContext,
  loadCachedDesignSystem,
  saveDesignSystemCache,
} from './designSystemCache';

const STORAGE_KEY = 'pair-designer-settings';
const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-4-6';
const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';

function normalizeModel(provider: Settings['provider'], model: string): string {
  const raw = (model || '').trim();
  if (!raw) {
    return provider === 'anthropic' ? DEFAULT_ANTHROPIC_MODEL : DEFAULT_OPENAI_MODEL;
  }
  if (provider === 'anthropic') {
    if (raw === 'claude-sonnet-4-20250514') return 'claude-sonnet-4-6';
    if (raw.startsWith('claude-sonnet-4-6')) return 'claude-sonnet-4-6';
    if (raw.startsWith('claude-haiku-4-5')) return 'claude-haiku-4-5';
    if (raw.startsWith('claude-opus-4-6')) return 'claude-opus-4-6';
    return DEFAULT_ANTHROPIC_MODEL;
  }
  if (provider === 'openai') {
    if (raw.startsWith('gpt-4o-mini-')) return 'gpt-4o-mini';
    if (raw.startsWith('gpt-4o-') && raw.split('-').length > 2) return 'gpt-4o';
    if (raw === 'gpt-4o-mini' || raw === 'gpt-4o') return raw;
    return DEFAULT_OPENAI_MODEL;
  }
  return raw;
}

function normalizeSettings(settings: Settings): Settings {
  return {
    ...settings,
    model: normalizeModel(settings.provider, settings.model),
  };
}

figma.showUI(__html__, { width: 360, height: 640, themeColors: true });

// --- Selection change listener ---
figma.on('selectionchange', () => {
  sendSelectionData();
  checkForMarkerSelection();
});

function sendSelectionData() {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    figma.ui.postMessage({ type: 'SELECTION_DATA', payload: null });
    return;
  }

  const node = selection[0];
  const payload: Record<string, unknown> = {
    id: node.id,
    name: node.name,
    type: node.type,
    width: 'width' in node ? Math.round(node.width) : 0,
    height: 'height' in node ? Math.round(node.height) : 0,
    childCount: countDescendants(node),
  };

  // Export a small thumbnail (fire and forget — send basic data first, update with thumbnail)
  figma.ui.postMessage({ type: 'SELECTION_DATA', payload });

  if ('exportAsync' in node) {
    (node as SceneNode & ExportMixin).exportAsync({
      format: 'PNG',
      constraint: { type: 'WIDTH', value: 64 },
    }).then((bytes: Uint8Array) => {
      const base64 = figma.base64Encode(bytes);
      figma.ui.postMessage({
        type: 'SELECTION_DATA',
        payload: { ...payload, thumbnail: `data:image/png;base64,${base64}` },
      });
    }).catch(() => {
      // Thumbnail export failed — no-op, basic data already sent
    });
  }
}

// --- Check if user selected a review marker on canvas ---
function checkForMarkerSelection() {
  const selection = figma.currentPage.selection;
  if (selection.length !== 1) return;
  const node = selection[0];
  if (node.getPluginData('ai-review-note') !== '1') return;

  const indexStr = node.getPluginData('ai-review-index');
  const nodeId = node.getPluginData('ai-review-nodeId');
  if (indexStr && nodeId) {
    figma.ui.postMessage({
      type: 'MARKER_SELECTED',
      payload: { index: parseInt(indexStr, 10), nodeId },
    });
  }
}

// --- Message handler ---
figma.ui.onmessage = async (msg: UIToPluginMessage) => {
  try {
    switch (msg.type) {
      case 'GET_SELECTION': {
        sendSelectionData();
        break;
      }

      case 'RUN_REVIEW': {
        const selection = figma.currentPage.selection;
        if (selection.length === 0) {
          figma.ui.postMessage({
            type: 'ERROR',
            payload: { message: 'No frame selected. Select a frame to review.' },
          });
          return;
        }

        const node = selection[0];
        figma.ui.postMessage({
          type: 'SELECTION_DATA',
          payload: {
            id: node.id,
            name: node.name,
            type: node.type,
            width: 'width' in node ? Math.round(node.width) : 0,
            height: 'height' in node ? Math.round(node.height) : 0,
            childCount: countDescendants(node),
          },
        });

        const { json, screenshot } = await getDesignData(
          node,
          msg.payload.includeScreenshot
        );

        figma.ui.postMessage({
          type: 'DESIGN_DATA_READY',
          payload: { json, screenshot },
        });
        break;
      }

      case 'WRITE_ANNOTATIONS': {
        const selection = figma.currentPage.selection;
        const settings = await figma.clientStorage.getAsync(STORAGE_KEY);
        const outputMode = settings?.outputMode || 'annotations';
        const useAnnotations = outputMode === 'annotations' || outputMode === 'both';
        const useStickyNotes = outputMode === 'sticky-notes' || outputMode === 'both';

        // Write annotations (if enabled and supported)
        if (useAnnotations) {
          try {
            const categoryId = await getOrCreateAIReviewCategory();

            if (settings?.autoClearPrevious && selection.length > 0) {
              await clearAIAnnotations(selection[0], categoryId);
            }

            const { written, skipped } = await writeAnnotations(
              msg.payload.reviewItems,
              categoryId
            );

            figma.ui.postMessage({
              type: 'ANNOTATIONS_WRITTEN',
              payload: { written, skipped, annotationsSupported: true },
            });
          } catch (_e) {
            // Annotations API not available (likely free plan without Dev Mode)
            figma.ui.postMessage({
              type: 'ANNOTATIONS_WRITTEN',
              payload: {
                written: 0,
                skipped: msg.payload.reviewItems.length,
                annotationsSupported: false,
              },
            });
          }
        }

        // Write sticky notes on canvas (if enabled)
        if (useStickyNotes && selection.length > 0) {
          if (settings?.autoClearPrevious) {
            const parent = selection[0].parent || figma.currentPage;
            await clearStickyNotes(parent);
          }

          const { created } = await writeStickyNotes(
            msg.payload.reviewItems,
            selection[0]
          );

          figma.ui.postMessage({
            type: 'STICKY_NOTES_WRITTEN',
            payload: { created },
          });
        }
        break;
      }

      case 'CLEAR_ANNOTATIONS': {
        const selection = figma.currentPage.selection;
        if (selection.length === 0) {
          figma.ui.postMessage({
            type: 'ERROR',
            payload: { message: 'No frame selected. Select a frame to clear.' },
          });
          return;
        }

        // Clear annotations (if supported)
        try {
          const categoryId = await getOrCreateAIReviewCategory();
          await clearAIAnnotations(selection[0], categoryId);
        } catch (_e) {
          // Annotations not available — skip silently
        }

        // Clear sticky notes
        const parent = selection[0].parent || figma.currentPage;
        await clearStickyNotes(parent);

        figma.ui.postMessage({ type: 'ANNOTATIONS_CLEARED' });
        break;
      }

      case 'STORE_SETTINGS': {
        await figma.clientStorage.setAsync(STORAGE_KEY, normalizeSettings(msg.payload));
        break;
      }

      case 'FOCUS_NODE': {
        const targetId = msg.payload.nodeId;
        const targetNode = await figma.getNodeByIdAsync(targetId);
        if (targetNode && targetNode.type !== 'PAGE' && targetNode.type !== 'DOCUMENT') {
          const sceneNode = targetNode as SceneNode;
          figma.currentPage.selection = [sceneNode];
          figma.viewport.scrollAndZoomIntoView([sceneNode]);
        }
        break;
      }

      case 'DISMISS_REVIEW_ITEM': {
        dismissReviewItem(msg.payload.index);
        figma.ui.postMessage({
          type: 'ITEM_DISMISSED',
          payload: { index: msg.payload.index },
        });
        break;
      }

      case 'GET_SETTINGS': {
        const stored = await figma.clientStorage.getAsync(STORAGE_KEY);
        const defaults: Settings = {
          provider: 'anthropic',
          apiKey: '',
          model: DEFAULT_ANTHROPIC_MODEL,
          includeScreenshot: true,
          autoClearPrevious: true,
          outputMode: 'sticky-notes',
        };
        const merged = stored ? { ...defaults, ...stored } : defaults;
        const normalized = normalizeSettings(merged);
        figma.ui.postMessage({
          type: 'SETTINGS_LOADED',
          payload: normalized,
        });
        if (!stored || normalized.model !== merged.model) {
          await figma.clientStorage.setAsync(STORAGE_KEY, normalized);
        }
        break;
      }

      case 'SCAN_DESIGN_SYSTEM': {
        const cache = scanDesignSystem();
        await saveDesignSystemCache(cache);
        const promptContext = cacheToPromptContext(cache);
        figma.ui.postMessage({
          type: 'DESIGN_SYSTEM_SCANNED',
          payload: { cache, promptContext },
        });
        break;
      }

      case 'GET_DESIGN_SYSTEM_CACHE': {
        const cached = await loadCachedDesignSystem();
        if (cached) {
          const promptContext = cacheToPromptContext(cached);
          figma.ui.postMessage({
            type: 'DESIGN_SYSTEM_CACHE_LOADED',
            payload: { cache: cached, promptContext },
          });
        } else {
          figma.ui.postMessage({
            type: 'DESIGN_SYSTEM_CACHE_LOADED',
            payload: null,
          });
        }
        break;
      }

      case 'IMPORT_DESIGN_SYSTEM_CACHE': {
        const imported = msg.payload.cache;
        await saveDesignSystemCache(imported as any);
        const promptCtx = cacheToPromptContext(imported as any);
        figma.ui.postMessage({
          type: 'DESIGN_SYSTEM_SCANNED',
          payload: { cache: imported, promptContext: promptCtx },
        });
        break;
      }
    }
  } catch (err: any) {
    figma.ui.postMessage({
      type: 'ERROR',
      payload: { message: err?.message || 'An unexpected error occurred.' },
    });
  }
};

// Send initial selection data
sendSelectionData();
