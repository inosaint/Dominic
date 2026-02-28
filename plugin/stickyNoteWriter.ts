// Creates small numbered marker pins on the canvas at flagged nodes
// Detail is shown in the plugin UI panel — markers are just pointers

import { ReviewItem } from './types';

const SEVERITY_COLORS: Record<string, { bg: RGB; text: RGB }> = {
  issue: {
    bg: { r: 0.95, g: 0.28, b: 0.13 },   // #F24822
    text: { r: 1, g: 1, b: 1 },
  },
  warning: {
    bg: { r: 0.95, g: 0.6, b: 0.07 },     // #F29912
    text: { r: 1, g: 1, b: 1 },
  },
  suggestion: {
    bg: { r: 0.48, g: 0.38, b: 1 },       // #7B61FF
    text: { r: 1, g: 1, b: 1 },
  },
};

const MARKER_SIZE = 24;

async function loadFonts() {
  await Promise.all([
    figma.loadFontAsync({ family: 'Inter', style: 'Regular' }),
    figma.loadFontAsync({ family: 'Inter', style: 'Bold' }),
  ]);
}

function createMarker(item: ReviewItem, index: number): FrameNode {
  const colors = SEVERITY_COLORS[item.severity] || SEVERITY_COLORS.suggestion;

  // Outer circle frame
  const marker = figma.createFrame();
  marker.name = `AI Review #${index + 1}: ${item.category} (${item.severity})`;
  marker.resize(MARKER_SIZE, MARKER_SIZE);
  marker.cornerRadius = MARKER_SIZE / 2; // perfect circle
  marker.fills = [{ type: 'SOLID', color: colors.bg }];
  marker.strokes = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
  marker.strokeWeight = 2;
  marker.strokeAlign = 'OUTSIDE';
  marker.effects = [
    {
      type: 'DROP_SHADOW',
      color: { r: 0, g: 0, b: 0, a: 0.25 },
      offset: { x: 0, y: 1 },
      radius: 4,
      spread: 0,
      visible: true,
      blendMode: 'NORMAL',
    },
  ];

  // Center the number
  marker.layoutMode = 'HORIZONTAL';
  marker.primaryAxisAlignItems = 'CENTER';
  marker.counterAxisAlignItems = 'CENTER';

  // Number label
  const label = figma.createText();
  label.fontName = { family: 'Inter', style: 'Bold' };
  label.characters = String(index + 1);
  label.fontSize = index < 9 ? 12 : 10; // smaller font for 2-digit numbers
  label.fills = [{ type: 'SOLID', color: colors.text }];
  label.textAlignHorizontal = 'CENTER';
  label.textAlignVertical = 'CENTER';
  marker.appendChild(label);

  // Store metadata so we can identify and clean up markers
  marker.setPluginData('ai-review-note', '1');
  marker.setPluginData('ai-review-index', String(index));
  marker.setPluginData('ai-review-nodeId', item.nodeId);

  return marker;
}

export async function writeStickyNotes(
  reviewItems: ReviewItem[],
  anchorNode: SceneNode
): Promise<{ created: number }> {
  await loadFonts();

  // Sort: issues first, then warnings, then suggestions
  const sorted = [...reviewItems].sort((a, b) => {
    const order: Record<string, number> = { issue: 0, warning: 1, suggestion: 2 };
    return (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
  });

  const cardsPerNode = new Map<string, number>();
  let created = 0;

  function getAbsoluteXY(node: SceneNode): { x: number; y: number; width: number; height: number } {
    const transform = node.absoluteTransform;
    const x = transform[0][2];
    const y = transform[1][2];
    const width = 'width' in node ? node.width : 0;
    const height = 'height' in node ? node.height : 0;
    return { x, y, width, height };
  }

  const fallback = getAbsoluteXY(anchorNode);

  for (let i = 0; i < sorted.length; i++) {
    const item = sorted[i];
    const marker = createMarker(item, i);
    figma.currentPage.appendChild(marker);

    const target = await figma.getNodeByIdAsync(item.nodeId);
    const targetNode = target && target.type !== 'PAGE' && target.type !== 'DOCUMENT'
      ? (target as SceneNode)
      : null;

    const anchor = targetNode ? getAbsoluteXY(targetNode) : fallback;
    const stackIndex = cardsPerNode.get(item.nodeId) ?? 0;
    cardsPerNode.set(item.nodeId, stackIndex + 1);

    // Place at top-right corner of the target node, stacking horizontally if multiple
    marker.x = anchor.x + anchor.width - MARKER_SIZE / 2 + stackIndex * (MARKER_SIZE + 4);
    marker.y = anchor.y - MARKER_SIZE / 2;
    created++;
  }

  return { created };
}

export async function clearStickyNotes(parent: BaseNode): Promise<number> {
  let removed = 0;
  const seen = new Set<string>();

  function removeFrom(root: BaseNode) {
    if (!('children' in root)) return;
    const children = [...(root as ChildrenMixin).children] as SceneNode[];
    for (const child of children) {
      if (seen.has(child.id)) continue;
      seen.add(child.id);

      const isReviewNote =
        child.name.startsWith('AI Review #') ||
        child.name.startsWith('AI Review Note:') ||
        child.name === 'AI Review Notes' ||
        child.getPluginData('ai-review-note') === '1';

      if (isReviewNote) {
        child.remove();
        removed++;
        continue;
      }

      removeFrom(child);
    }
  }

  removeFrom(parent);
  if (parent !== figma.currentPage) {
    removeFrom(figma.currentPage);
  }

  return removed;
}
