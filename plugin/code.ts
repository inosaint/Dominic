// Pair Designer — Figma Plugin Sandbox Code
// This runs in Figma's plugin sandbox (no DOM access)

import { UIToPluginMessage, Settings } from './types';
import { getDesignData, countDescendants } from './extractDesignData';
import {
  getOrCreateAIReviewCategory,
  writeAnnotations,
  clearAIAnnotations,
} from './annotationWriter';
import { writeStickyNotes, clearStickyNotes } from './stickyNoteWriter';

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
          } catch {
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
        } catch {
          // Annotations not available — skip silently
        }

        // Clear sticky notes
        const parent = selection[0].parent || figma.currentPage;
        await clearStickyNotes(parent);

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
          outputMode: 'sticky-notes',
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
