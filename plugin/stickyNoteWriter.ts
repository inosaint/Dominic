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

function createStickyNote(item: ReviewItem, index: number): FrameNode {
  const colors = SEVERITY_COLORS[item.severity] || SEVERITY_COLORS.suggestion;

  // Outer card frame
  const card = figma.createFrame();
  card.name = `AI Review: ${item.category} (${item.severity})`;
  card.layoutMode = 'HORIZONTAL';
  card.primaryAxisSizingMode = 'AUTO';
  card.counterAxisSizingMode = 'AUTO';
  card.itemSpacing = 0;
  card.fills = [{ type: 'SOLID', color: colors.bg }];
  card.cornerRadius = 8;
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

  // Left severity stripe
  const stripe = figma.createFrame();
  stripe.name = 'severity-stripe';
  stripe.resize(4, 1);
  stripe.layoutAlign = 'STRETCH';
  stripe.layoutGrow = 0;
  stripe.fills = [{ type: 'SOLID', color: colors.border }];
  stripe.topLeftRadius = 8;
  stripe.bottomLeftRadius = 8;
  card.appendChild(stripe);

  // Content area
  const content = figma.createFrame();
  content.name = 'content';
  content.layoutMode = 'VERTICAL';
  content.primaryAxisSizingMode = 'AUTO';
  content.counterAxisSizingMode = 'FIXED';
  content.resize(240, 1);
  content.itemSpacing = 6;
  content.paddingTop = 10;
  content.paddingBottom = 10;
  content.paddingLeft = 12;
  content.paddingRight = 12;
  content.fills = [];
  card.appendChild(content);

  // Header row: severity icon + category
  const header = figma.createText();
  header.name = 'header';
  const severityLabel = item.severity === 'issue' ? 'Issue' : item.severity === 'warning' ? 'Warning' : 'Suggestion';
  header.characters = `${severityLabel} \u00B7 ${CATEGORY_LABELS[item.category] || item.category}`;
  header.fontName = { family: 'Inter', style: 'Bold' };
  header.fontSize = 11;
  header.fills = [{ type: 'SOLID', color: colors.border }];
  header.layoutSizingHorizontal = 'FILL';
  content.appendChild(header);

  // Feedback text
  const feedback = figma.createText();
  feedback.name = 'feedback';
  feedback.characters = item.feedback;
  feedback.fontName = { family: 'Inter', style: 'Regular' };
  feedback.fontSize = 12;
  feedback.lineHeight = { value: 18, unit: 'PIXELS' };
  feedback.fills = [{ type: 'SOLID', color: { r: 0.15, g: 0.15, b: 0.15 } }];
  feedback.layoutSizingHorizontal = 'FILL';
  content.appendChild(feedback);

  // Node reference
  const nodeRef = figma.createText();
  nodeRef.name = 'node-ref';
  nodeRef.characters = `Node: ${item.nodeId}`;
  nodeRef.fontName = { family: 'Inter', style: 'Regular' };
  nodeRef.fontSize = 10;
  nodeRef.fills = [{ type: 'SOLID', color: { r: 0.55, g: 0.55, b: 0.55 } }];
  nodeRef.layoutSizingHorizontal = 'FILL';
  content.appendChild(nodeRef);

  return card;
}

export async function writeStickyNotes(
  reviewItems: ReviewItem[],
  anchorNode: SceneNode
): Promise<{ created: number }> {
  await loadFonts();

  // Container frame for all sticky notes
  const container = figma.createFrame();
  container.name = 'AI Review Notes';
  container.layoutMode = 'VERTICAL';
  container.primaryAxisSizingMode = 'AUTO';
  container.counterAxisSizingMode = 'AUTO';
  container.itemSpacing = 12;
  container.paddingTop = 16;
  container.paddingBottom = 16;
  container.paddingLeft = 16;
  container.paddingRight = 16;
  container.fills = [{ type: 'SOLID', color: { r: 0.97, g: 0.97, b: 0.97 } }];
  container.cornerRadius = 12;
  container.effects = [
    {
      type: 'DROP_SHADOW',
      color: { r: 0, g: 0, b: 0, a: 0.08 },
      offset: { x: 0, y: 4 },
      radius: 16,
      spread: 0,
      visible: true,
      blendMode: 'NORMAL',
    },
  ];

  // Title
  const title = figma.createText();
  title.name = 'title';
  title.characters = `AI Review \u00B7 ${reviewItems.length} item${reviewItems.length !== 1 ? 's' : ''}`;
  title.fontName = { family: 'Inter', style: 'Bold' };
  title.fontSize = 14;
  title.fills = [{ type: 'SOLID', color: { r: 0.15, g: 0.15, b: 0.15 } }];
  container.appendChild(title);

  // Sort: issues first, then warnings, then suggestions
  const sorted = [...reviewItems].sort((a, b) => {
    const order = { issue: 0, warning: 1, suggestion: 2 };
    return (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
  });

  for (let i = 0; i < sorted.length; i++) {
    const card = createStickyNote(sorted[i], i);
    container.appendChild(card);
  }

  // Position to the right of the anchor node with some gap
  const anchorX = 'x' in anchorNode ? anchorNode.x : 0;
  const anchorY = 'y' in anchorNode ? anchorNode.y : 0;
  const anchorWidth = 'width' in anchorNode ? anchorNode.width : 0;

  container.x = anchorX + anchorWidth + 80;
  container.y = anchorY;

  // Add to the same parent as the anchor if possible
  if (anchorNode.parent && anchorNode.parent.type !== 'DOCUMENT') {
    try {
      (anchorNode.parent as ChildrenMixin).appendChild(container);
    } catch {
      // If we can't add to the same parent, it stays on the page (default)
    }
  }

  return { created: reviewItems.length };
}

export async function clearStickyNotes(parent: BaseNode): Promise<number> {
  let removed = 0;

  if ('children' in parent) {
    const children = [...(parent as ChildrenMixin).children] as SceneNode[];
    for (const child of children) {
      if (child.name === 'AI Review Notes') {
        child.remove();
        removed++;
      }
    }
  }

  return removed;
}
