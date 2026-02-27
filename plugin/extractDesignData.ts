// Design data extraction from Figma node tree

export interface ExtractedNode {
  id: string;
  name: string;
  type: string;
  width: number;
  height: number;
  x: number;
  y: number;
  // Visual
  fills?: FillSummary[];
  strokes?: StrokeSummary[];
  cornerRadius?: number | number[];
  opacity?: number;
  effects?: EffectSummary[];
  // Text
  characters?: string;
  fontSize?: number | 'mixed';
  fontFamily?: string | 'mixed';
  fontWeight?: number | 'mixed';
  lineHeight?: LineHeightSummary | 'mixed';
  textAlignHorizontal?: string;
  textAlignVertical?: string;
  // Layout
  layoutMode?: 'HORIZONTAL' | 'VERTICAL' | 'NONE';
  layoutSizingHorizontal?: 'FIXED' | 'HUG' | 'FILL';
  layoutSizingVertical?: 'FIXED' | 'HUG' | 'FILL';
  itemSpacing?: number;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  primaryAxisAlignItems?: string;
  counterAxisAlignItems?: string;
  // Component info
  isComponent?: boolean;
  isInstance?: boolean;
  mainComponentName?: string;
  // Children
  children?: ExtractedNode[];
}

interface FillSummary {
  type: string;
  color?: string;
  opacity?: number;
}

interface StrokeSummary {
  type: string;
  color?: string;
  weight?: number;
}

interface EffectSummary {
  type: string;
  radius?: number;
  color?: string;
  offset?: { x: number; y: number };
}

interface LineHeightSummary {
  value: number;
  unit: string;
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (c: number) =>
    Math.round(c * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function extractFills(node: SceneNode): FillSummary[] | undefined {
  if (!('fills' in node) || node.fills === figma.mixed) return undefined;
  const fills = node.fills as readonly Paint[];
  if (fills.length === 0) return undefined;

  return fills
    .filter((f) => f.visible !== false)
    .map((f) => {
      const summary: FillSummary = { type: f.type };
      if (f.type === 'SOLID') {
        summary.color = rgbToHex(f.color.r, f.color.g, f.color.b);
        if (f.opacity !== undefined && f.opacity < 1) {
          summary.opacity = Math.round(f.opacity * 100) / 100;
        }
      }
      return summary;
    });
}

function extractStrokes(node: SceneNode): StrokeSummary[] | undefined {
  if (!('strokes' in node)) return undefined;
  const strokes = node.strokes as readonly Paint[];
  if (strokes.length === 0) return undefined;

  return strokes
    .filter((s) => s.visible !== false)
    .map((s) => {
      const summary: StrokeSummary = { type: s.type };
      if (s.type === 'SOLID') {
        summary.color = rgbToHex(s.color.r, s.color.g, s.color.b);
      }
      if ('strokeWeight' in node && typeof node.strokeWeight === 'number') {
        summary.weight = node.strokeWeight;
      }
      return summary;
    });
}

function extractEffects(node: SceneNode): EffectSummary[] | undefined {
  if (!('effects' in node)) return undefined;
  const effects = node.effects as readonly Effect[];
  if (effects.length === 0) return undefined;

  return effects
    .filter((e) => e.visible !== false)
    .map((e) => {
      const summary: EffectSummary = { type: e.type };
      if ('radius' in e) summary.radius = e.radius;
      if ('color' in e && e.color) {
        summary.color = rgbToHex(e.color.r, e.color.g, e.color.b);
      }
      if ('offset' in e && e.offset) {
        summary.offset = { x: e.offset.x, y: e.offset.y };
      }
      return summary;
    });
}

function extractCornerRadius(node: SceneNode): number | number[] | undefined {
  if (!('cornerRadius' in node)) return undefined;
  if (node.cornerRadius === figma.mixed) {
    if (
      'topLeftRadius' in node &&
      'topRightRadius' in node &&
      'bottomRightRadius' in node &&
      'bottomLeftRadius' in node
    ) {
      return [
        (node as any).topLeftRadius,
        (node as any).topRightRadius,
        (node as any).bottomRightRadius,
        (node as any).bottomLeftRadius,
      ];
    }
    return undefined;
  }
  return node.cornerRadius > 0 ? node.cornerRadius : undefined;
}

export function extractNode(node: SceneNode, depth: number = 0, maxDepth: number = 5): ExtractedNode {
  const extracted: ExtractedNode = {
    id: node.id,
    name: node.name,
    type: node.type,
    width: 'width' in node ? Math.round(node.width) : 0,
    height: 'height' in node ? Math.round(node.height) : 0,
    x: Math.round(node.x),
    y: Math.round(node.y),
  };

  // Visual properties
  const fills = extractFills(node);
  if (fills) extracted.fills = fills;

  const strokes = extractStrokes(node);
  if (strokes) extracted.strokes = strokes;

  const cornerRadius = extractCornerRadius(node);
  if (cornerRadius !== undefined) extracted.cornerRadius = cornerRadius;

  if ('opacity' in node && node.opacity < 1) {
    extracted.opacity = Math.round(node.opacity * 100) / 100;
  }

  const effects = extractEffects(node);
  if (effects) extracted.effects = effects;

  // Text properties
  if (node.type === 'TEXT') {
    const textNode = node as TextNode;
    extracted.characters = textNode.characters;
    extracted.fontSize =
      textNode.fontSize === figma.mixed ? 'mixed' : (textNode.fontSize as number);
    extracted.fontFamily =
      textNode.fontFamily === figma.mixed
        ? 'mixed'
        : (textNode.fontFamily as string);
    extracted.fontWeight =
      textNode.fontWeight === figma.mixed
        ? 'mixed'
        : (textNode.fontWeight as number);

    if (textNode.lineHeight !== figma.mixed) {
      const lh = textNode.lineHeight as LineHeight;
      if (lh.unit !== 'AUTO') {
        extracted.lineHeight = { value: lh.value, unit: lh.unit };
      }
    } else {
      extracted.lineHeight = 'mixed';
    }

    extracted.textAlignHorizontal = textNode.textAlignHorizontal;
    extracted.textAlignVertical = textNode.textAlignVertical;
  }

  // Layout properties (auto layout)
  if ('layoutMode' in node) {
    const frame = node as FrameNode;
    if (frame.layoutMode !== 'NONE') {
      extracted.layoutMode = frame.layoutMode;
      extracted.layoutSizingHorizontal = frame.layoutSizingHorizontal;
      extracted.layoutSizingVertical = frame.layoutSizingVertical;
      extracted.itemSpacing = frame.itemSpacing;
      extracted.paddingTop = frame.paddingTop;
      extracted.paddingRight = frame.paddingRight;
      extracted.paddingBottom = frame.paddingBottom;
      extracted.paddingLeft = frame.paddingLeft;
      extracted.primaryAxisAlignItems = frame.primaryAxisAlignItems;
      extracted.counterAxisAlignItems = frame.counterAxisAlignItems;
    }
  }

  // Component info
  if (node.type === 'COMPONENT') {
    extracted.isComponent = true;
  } else if (node.type === 'INSTANCE') {
    extracted.isInstance = true;
    const instance = node as InstanceNode;
    if (instance.mainComponent) {
      extracted.mainComponentName = instance.mainComponent.name;
    }
  }

  // Children (with depth limit)
  if ('children' in node && depth < maxDepth) {
    const children = (node as ChildrenMixin).children as readonly SceneNode[];
    if (children.length > 0) {
      extracted.children = children.map((child) =>
        extractNode(child, depth + 1, maxDepth)
      );
    }
  }

  return extracted;
}

export function countDescendants(node: SceneNode): number {
  let count = 0;
  if ('children' in node) {
    const children = (node as ChildrenMixin).children as readonly SceneNode[];
    count += children.length;
    for (const child of children) {
      count += countDescendants(child);
    }
  }
  return count;
}

const TOKEN_BUDGET = 30000;
const CHARS_PER_TOKEN = 4;

export function estimateTokens(data: object): number {
  return Math.ceil(JSON.stringify(data).length / CHARS_PER_TOKEN);
}

export function pruneForReview(json: any): any {
  const STRIP_KEYS = new Set([
    'absoluteTransform',
    'relativeTransform',
    'absoluteBoundingBox',
    'absoluteRenderBounds',
    'fillGeometry',
    'strokeGeometry',
    'vectorPaths',
    'vectorNetwork',
    'imageHash',
    'transitionNodeID',
    'transitionDuration',
    'transitionEasing',
    'exportSettings',
    'pluginData',
    'sharedPluginData',
    'componentPropertyDefinitions',
    'componentPropertyReferences',
  ]);

  function prune(obj: any, depth: number): any {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) {
      return obj.map((item) => prune(item, depth));
    }
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (STRIP_KEYS.has(key)) continue;
      if (key === 'children' && depth > 5) {
        result[key] = `[${(value as any[]).length} children omitted]`;
        continue;
      }
      result[key] = prune(value, key === 'children' ? depth + 1 : depth);
    }
    return result;
  }

  return prune(json, 0);
}

export async function getDesignData(
  node: SceneNode,
  includeScreenshot: boolean
): Promise<{ json: object; screenshot?: string }> {
  // Try full JSON export first
  let jsonData: any;
  try {
    const rawJson = await node.exportAsync({ format: 'JSON_REST_V1' });
    jsonData = pruneForReview(rawJson);
  } catch {
    // Fall back to custom extraction
    jsonData = extractNode(node);
  }

  // Check token budget — if over, use lightweight extraction
  if (estimateTokens(jsonData) > TOKEN_BUDGET) {
    jsonData = extractNode(node);
  }

  let screenshot: string | undefined;
  if (includeScreenshot) {
    try {
      const bytes = await node.exportAsync({
        format: 'PNG',
        constraint: { type: 'SCALE', value: 2 },
      });
      screenshot = figma.base64Encode(bytes);
    } catch {
      // Screenshot export failed — continue without it
    }
  }

  return { json: jsonData, screenshot };
}
