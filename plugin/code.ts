// Pair Designer — Figma Plugin Sandbox Code
// This runs in Figma's plugin sandbox (no DOM access)

import { UIToPluginMessage, Settings } from './types';
import { getDesignData, countDescendants } from './extractDesignData';
import {
  getOrCreateAIReviewCategory,
  writeAnnotations,
  clearAIAnnotations,
} from './annotationWriter';

const STORAGE_KEY = 'pair-designer-settings';

figma.showUI(__html__, { width: 320, height: 480, themeColors: true });

// --- Selection change listener ---
figma.on('selectionchange', () => {
  sendSelectionData();
});

function sendSelectionData() {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    figma.ui.postMessage({ type: 'SELECTION_DATA', payload: null });
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

        // Try to write annotations — gracefully degrade on free plans
        // where the annotations API may not be available (requires Dev Mode)
        try {
          const categoryId = await getOrCreateAIReviewCategory();

          const settings = await figma.clientStorage.getAsync(STORAGE_KEY);
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
        } catch {
          // Annotations API not available (likely free plan without Dev Mode)
          // The UI already shows feedback in the chat window as a fallback
          figma.ui.postMessage({
            type: 'ANNOTATIONS_WRITTEN',
            payload: {
              written: 0,
              skipped: msg.payload.reviewItems.length,
              annotationsSupported: false,
            },
          });
        }
        break;
      }

      case 'CLEAR_ANNOTATIONS': {
        const selection = figma.currentPage.selection;
        if (selection.length === 0) {
          figma.ui.postMessage({
            type: 'ERROR',
            payload: { message: 'No frame selected. Select a frame to clear annotations.' },
          });
          return;
        }

        const categoryId = await getOrCreateAIReviewCategory();
        await clearAIAnnotations(selection[0], categoryId);

        figma.ui.postMessage({ type: 'ANNOTATIONS_CLEARED' });
        break;
      }

      case 'STORE_SETTINGS': {
        await figma.clientStorage.setAsync(STORAGE_KEY, msg.payload);
        break;
      }

      case 'GET_SETTINGS': {
        const stored = await figma.clientStorage.getAsync(STORAGE_KEY);
        const defaults: Settings = {
          provider: 'anthropic',
          apiKey: '',
          model: 'claude-sonnet-4-20250514',
          includeScreenshot: true,
          autoClearPrevious: true,
        };
        figma.ui.postMessage({
          type: 'SETTINGS_LOADED',
          payload: stored ? { ...defaults, ...stored } : defaults,
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
