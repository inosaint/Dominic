// Creates numbered marker pins + note cards on the canvas at flagged nodes
// Markers are selectable — clicking one highlights the item in the UI panel

import { ReviewItem } from './types';

const SEVERITY_COLORS: Record<string, { bg: RGB; glow: RGBA; text: RGB }> = {
  issue: {
    bg: { r: 0.95, g: 0.28, b: 0.13 },     // #F24822
    glow: { r: 0.95, g: 0.28, b: 0.13, a: 0.5 },
    text: { r: 1, g: 1, b: 1 },
  },
  warning: {
    bg: { r: 0.95, g: 0.6, b: 0.07 },       // #F29912
    glow: { r: 0.95, g: 0.6, b: 0.07, a: 0.5 },
    text: { r: 1, g: 1, b: 1 },
  },
  suggestion: {
    bg: { r: 0.48, g: 0.38, b: 1 },         // #7B61FF
    glow: { r: 0.48, g: 0.38, b: 1, a: 0.5 },
    text: { r: 1, g: 1, b: 1 },
  },
};

const SEVERITY_EMOJI: Record<string, string> = {
  issue: '\u{1F534}',
  warning: '\u26A0\uFE0F',
  suggestion: '\u{1F4A1}',
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
  i18n: 'Localization',
  tokens: 'Tokens',
  general: 'General',
};

const MARKER_SIZE = 32;
const NOTE_WIDTH = 240;
const NOTE_GAP = 10;
const NOTES_OFFSET_X = 60;
const CONNECTOR_STROKE = 1.5;

async function loadFonts() {
  await Promise.all([
    figma.loadFontAsync({ family: 'Inter', style: 'Regular' }),
    figma.loadFontAsync({ family: 'Inter', style: 'Bold' }),
  ]);
}

function createMarker(item: ReviewItem, index: number): FrameNode {
  const colors = SEVERITY_COLORS[item.severity] || SEVERITY_COLORS.suggestion;

  const marker = figma.createFrame();
  marker.name = `AI Review #${index + 1}: ${item.category} (${item.severity})`;
  marker.resize(MARKER_SIZE, MARKER_SIZE);
  marker.cornerRadius = MARKER_SIZE / 2;
  marker.fills = [{ type: 'SOLID', color: colors.bg }];
  marker.clipsContent = false;
  marker.effects = [
    // Glow: colored outer shadow, no offset
    {
      type: 'DROP_SHADOW',
      color: colors.glow,
      offset: { x: 0, y: 0 },
      radius: 16,
      visible: true,
      blendMode: 'NORMAL',
    },
    // Background blur
    {
      type: 'BACKGROUND_BLUR',
      blurType: 'NORMAL',
      radius: 8,
      visible: true,
    },
  ];

  // Center the number — keep both axes fixed at MARKER_SIZE
  marker.layoutMode = 'HORIZONTAL';
  marker.primaryAxisSizingMode = 'FIXED';
  marker.counterAxisSizingMode = 'FIXED';
  marker.primaryAxisAlignItems = 'CENTER';
  marker.counterAxisAlignItems = 'CENTER';

  const label = figma.createText();
  label.fontName = { family: 'Inter', style: 'Bold' };
  label.characters = String(index + 1);
  label.fontSize = index < 9 ? 14 : 11;
  label.fills = [{ type: 'SOLID', color: colors.text }];
  label.textAlignHorizontal = 'CENTER';
  label.textAlignVertical = 'CENTER';
  marker.appendChild(label);

  marker.setPluginData('ai-review-note', '1');
  marker.setPluginData('ai-review-index', String(index));
  marker.setPluginData('ai-review-nodeId', item.nodeId);

  return marker;
}

function createNoteCard(item: ReviewItem, index: number): FrameNode {
  const colors = SEVERITY_COLORS[item.severity] || SEVERITY_COLORS.suggestion;
  const emoji = SEVERITY_EMOJI[item.severity] || '\u{1F4A1}';
  const catLabel = CATEGORY_LABELS[item.category] || item.category;

  const card = figma.createFrame();
  card.name = `AI Note #${index + 1}: ${catLabel}`;
  card.resize(NOTE_WIDTH, 1);
  card.cornerRadius = 8;
  card.fills = [{ type: 'SOLID', color: { r: 0.12, g: 0.12, b: 0.14 }, opacity: 0.92 }];
  card.effects = [
    {
      type: 'BACKGROUND_BLUR',
      blurType: 'NORMAL',
      radius: 12,
      visible: true,
    },
    {
      type: 'DROP_SHADOW',
      color: { r: 0, g: 0, b: 0, a: 0.2 },
      offset: { x: 0, y: 2 },
      radius: 8,
      spread: 0,
      visible: true,
      blendMode: 'NORMAL',
    },
  ];

  card.layoutMode = 'VERTICAL';
  card.primaryAxisSizingMode = 'AUTO';
  card.counterAxisSizingMode = 'FIXED';
  card.paddingTop = 8;
  card.paddingRight = 10;
  card.paddingBottom = 8;
  card.paddingLeft = 10;
  card.itemSpacing = 4;

  // Header: emoji + category
  const header = figma.createText();
  header.fontName = { family: 'Inter', style: 'Bold' };
  header.characters = `${emoji} ${catLabel}`;
  header.fontSize = 11;
  header.fills = [{ type: 'SOLID', color: colors.bg }];
  card.appendChild(header);
  header.layoutSizingHorizontal = 'FILL';

  // Feedback body (truncated for canvas readability)
  const feedbackText = item.feedback.length > 120
    ? item.feedback.slice(0, 117) + '...'
    : item.feedback;
  const body = figma.createText();
  body.fontName = { family: 'Inter', style: 'Regular' };
  body.characters = feedbackText;
  body.fontSize = 11;
  body.lineHeight = { value: 16, unit: 'PIXELS' };
  body.fills = [{ type: 'SOLID', color: { r: 0.88, g: 0.88, b: 0.9 } }];
  card.appendChild(body);
  body.layoutSizingHorizontal = 'FILL';

  card.setPluginData('ai-review-note', '1');
  card.setPluginData('ai-review-index', String(index));
  card.setPluginData('ai-review-nodeId', item.nodeId);

  return card;
}

function createConnectorLine(
  x1: number, y1: number,
  x2: number, y2: number,
  color: RGB
): VectorNode {
  const minX = Math.min(x1, x2);
  const minY = Math.min(y1, y2);

  // L-shaped elbow: horizontal from marker to note column X, then vertical to note Y
  const line = figma.createVector();
  line.name = 'Connector';
  line.vectorPaths = [{
    windingRule: 'NONE',
    data: `M ${x1 - minX} ${y1 - minY} L ${x2 - minX} ${y1 - minY} L ${x2 - minX} ${y2 - minY}`,
  }];
  line.x = minX;
  line.y = minY;
  line.strokes = [{ type: 'SOLID', color, opacity: 0.4 }];
  line.strokeWeight = 1;
  line.dashPattern = [3, 2];
  line.fills = [];
  line.setPluginData('ai-review-note', '1');
  return line;
}

export async function writeStickyNotes(
  reviewItems: ReviewItem[],
  anchorNode: SceneNode
): Promise<{ created: number }> {
  await loadFonts();

  const sorted = [...reviewItems].sort((a, b) => {
    const order: Record<string, number> = { issue: 0, warning: 1, suggestion: 2 };
    return (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
  });

  function getAbsoluteXY(node: SceneNode) {
    const transform = node.absoluteTransform;
    return {
      x: transform[0][2],
      y: transform[1][2],
      width: 'width' in node ? node.width : 0,
      height: 'height' in node ? node.height : 0,
    };
  }

  const anchorBounds = getAbsoluteXY(anchorNode);
  const allNodes: SceneNode[] = [];
  const cardsPerNode = new Map<string, number>();

  // Phase 1: create markers + notes, position markers on targets
  const entries: Array<{
    marker: FrameNode;
    note: FrameNode;
    color: RGB;
  }> = [];

  for (let i = 0; i < sorted.length; i++) {
    const item = sorted[i];
    const colors = SEVERITY_COLORS[item.severity] || SEVERITY_COLORS.suggestion;

    const marker = createMarker(item, i);
    figma.currentPage.appendChild(marker);

    const note = createNoteCard(item, i);
    figma.currentPage.appendChild(note);

    const target = await figma.getNodeByIdAsync(item.nodeId);
    const targetNode = target && target.type !== 'PAGE' && target.type !== 'DOCUMENT'
      ? (target as SceneNode)
      : null;

    const anchor = targetNode ? getAbsoluteXY(targetNode) : anchorBounds;
    const stackIndex = cardsPerNode.get(item.nodeId) ?? 0;
    cardsPerNode.set(item.nodeId, stackIndex + 1);

    // Marker at top-right corner of target
    marker.x = anchor.x + anchor.width - MARKER_SIZE / 2 + stackIndex * (MARKER_SIZE + 4);
    marker.y = anchor.y - MARKER_SIZE / 2;

    entries.push({ marker, note, color: colors.bg });
    allNodes.push(marker);
  }

  // Phase 2: stack notes in a vertical column to the right, draw connector lines
  const noteColumnX = anchorBounds.x + anchorBounds.width + NOTES_OFFSET_X;
  let noteY = anchorBounds.y;

  for (const { marker, note, color } of entries) {
    note.x = noteColumnX;
    note.y = noteY;

    const noteHeight = Math.max(note.height, 50);

    // L-shaped connector from marker right edge to note left-center
    const connector = createConnectorLine(
      marker.x + MARKER_SIZE,
      marker.y + MARKER_SIZE / 2,
      noteColumnX,
      noteY + noteHeight / 2,
      color
    );
    figma.currentPage.appendChild(connector);

    allNodes.push(note, connector);
    noteY += noteHeight + NOTE_GAP;
  }

  // Group all into one layers entry (unlocked so markers are selectable)
  if (allNodes.length > 0) {
    const group = figma.group(allNodes, figma.currentPage);
    group.name = 'AI Review Notes';
    group.locked = false;
    group.setPluginData('ai-review-note', '1');
  }

  return { created: entries.length };
}

/** Remove a single review item (marker + note) by its index */
export function dismissReviewItem(index: number): boolean {
  const target = String(index);
  let removed = false;

  function searchIn(root: BaseNode) {
    if (!('children' in root)) return;
    const children = [...(root as ChildrenMixin).children] as SceneNode[];
    for (const child of children) {
      if (child.getPluginData('ai-review-index') === target) {
        child.remove();
        removed = true;
        continue;
      }
      searchIn(child);
    }
  }

  searchIn(figma.currentPage);
  return removed;
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
        child.name.startsWith('AI Note #') ||
        child.name === 'AI Review Notes' ||
        child.name === 'Connector' ||
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
