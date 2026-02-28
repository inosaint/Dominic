// Creates sticky-note-like feedback cards on the canvas
// Works on all Figma plans — no Dev Mode required

import { ReviewItem } from './types';

const SEVERITY_COLORS: Record<string, { bg: RGB; border: RGB; text: string }> = {
  issue: {
    bg: { r: 0.95, g: 0.91, b: 0.9 },
    border: { r: 0.95, g: 0.28, b: 0.13 },
    text: '#F24822',
  },
  warning: {
    bg: { r: 0.97, g: 0.94, b: 0.88 },
    border: { r: 0.95, g: 0.6, b: 0.29 },
    text: '#F2994A',
  },
  suggestion: {
    bg: { r: 0.91, g: 0.93, b: 0.97 },
    border: { r: 0.48, g: 0.38, b: 1 },
    text: '#7B61FF',
  },
};

const CATEGORY_LABELS: Record<string, string> = {
  spacing: 'Spacing',
  typography: 'Typography',
  color: 'Color',
  hierarchy: 'Hierarchy',
  accessibility: 'Accessibility',
  layout: 'Layout',
  consistency: 'Consistency',
  interaction: 'Interaction',
  general: 'General',
};

async function loadFonts() {
  await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });
  await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
}

function createStickyNote(item: ReviewItem): FrameNode {
  const colors = SEVERITY_COLORS[item.severity] || SEVERITY_COLORS.suggestion;

  const cardWidth = 300;
  const contentWidth = 276; // card width minus horizontal padding

  // Outer card
  const card = figma.createFrame();
  card.name = `AI Review Note: ${item.category} (${item.severity})`;
  card.layoutMode = 'VERTICAL';
  card.primaryAxisSizingMode = 'AUTO';
  card.counterAxisSizingMode = 'FIXED';
  card.resize(cardWidth, 1);
  card.itemSpacing = 6;
  card.paddingTop = 10;
  card.paddingBottom = 10;
  card.paddingLeft = 12;
  card.paddingRight = 12;
  card.fills = [{ type: 'SOLID', color: colors.bg }];
  card.cornerRadius = 8;
  card.strokes = [{ type: 'SOLID', color: colors.border }];
  card.strokeWeight = 1;
  card.effects = [
    {
      type: 'DROP_SHADOW',
      color: { r: 0, g: 0, b: 0, a: 0.1 },
      offset: { x: 0, y: 2 },
      radius: 8,
      spread: 0,
      visible: true,
      blendMode: 'NORMAL',
    },
  ];
  card.setPluginData('ai-review-note', '1');

  // Header row
  const header = figma.createText();
  header.name = 'header';
  const severityLabel = item.severity === 'issue' ? 'Issue' : item.severity === 'warning' ? 'Warning' : 'Suggestion';
  header.characters = `${severityLabel} \u00B7 ${CATEGORY_LABELS[item.category] || item.category}`;
  header.fontName = { family: 'Inter', style: 'Bold' };
  header.fontSize = 11;
  header.fills = [{ type: 'SOLID', color: colors.border }];
  card.appendChild(header);

  // Feedback text
  const feedback = figma.createText();
  feedback.name = 'feedback';
  feedback.characters = item.feedback;
  feedback.fontName = { family: 'Inter', style: 'Regular' };
  feedback.fontSize = 12;
  feedback.lineHeight = { value: 18, unit: 'PIXELS' };
  feedback.fills = [{ type: 'SOLID', color: { r: 0.15, g: 0.15, b: 0.15 } }];
  feedback.textAutoResize = 'HEIGHT';
  feedback.resize(contentWidth, 1);
  card.appendChild(feedback);

  // Node reference
  const nodeRef = figma.createText();
  nodeRef.name = 'node-ref';
  nodeRef.characters = `Node: ${item.nodeId}`;
  nodeRef.fontName = { family: 'Inter', style: 'Regular' };
  nodeRef.fontSize = 10;
  nodeRef.fills = [{ type: 'SOLID', color: { r: 0.55, g: 0.55, b: 0.55 } }];
  card.appendChild(nodeRef);

  return card;
}

export async function writeStickyNotes(
  reviewItems: ReviewItem[],
  anchorNode: SceneNode
): Promise<{ created: number }> {
  await loadFonts();

  // Sort: issues first, then warnings, then suggestions
  const sorted = [...reviewItems].sort((a, b) => {
    const order = { issue: 0, warning: 1, suggestion: 2 };
    return (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
  });

  const cardsPerNode = new Map<string, number>();
  let created = 0;

  function getAbsoluteXY(node: SceneNode): { x: number; y: number; width: number } {
    const transform = node.absoluteTransform;
    const x = transform[0][2];
    const y = transform[1][2];
    const width = 'width' in node ? node.width : 0;
    return { x, y, width };
  }

  const fallback = getAbsoluteXY(anchorNode);

  for (const item of sorted) {
    const card = createStickyNote(item);
    figma.currentPage.appendChild(card);

    const target = await figma.getNodeByIdAsync(item.nodeId);
    const targetNode = target && target.type !== 'PAGE' && target.type !== 'DOCUMENT'
      ? (target as SceneNode)
      : null;

    const anchor = targetNode ? getAbsoluteXY(targetNode) : fallback;
    const stackIndex = cardsPerNode.get(item.nodeId) ?? 0;
    cardsPerNode.set(item.nodeId, stackIndex + 1);

    card.x = anchor.x + anchor.width + 24;
    card.y = anchor.y + stackIndex * (card.height + 12);
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
