// Design system extraction — scans the current page to build a compact
// fingerprint of colors, typography, spacing, radii, effects, and components.
// The result is small enough (~500-1500 tokens) to inject into every LLM call
// so agents can reference the *actual* design system when giving feedback.

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (c: number) =>
    Math.round(c * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// ---- Collected token types ----

interface ColorEntry {
  count: number;
  token?: string; // bound variable name, if any
}

interface TypographyEntry {
  family: string;
  size: number;
  weight: number;
  lineHeight?: number;
  count: number;
}

interface ComponentEntry {
  name: string;
  instances: number;
}

export interface DesignSystemCache {
  colors: {
    fills: Record<string, ColorEntry>;
    strokes: Record<string, ColorEntry>;
  };
  typography: TypographyEntry[];
  spacing: {
    padding: Record<string, number>; // value → occurrence count
    gap: Record<string, number>;
  };
  radii: Record<string, number>; // value → occurrence count
  effects: Record<string, number>; // e.g. "drop-shadow 4px 4px 8px" → count
  components: ComponentEntry[];
  scannedAt: number;
  nodeCount: number;
  pageId: string;
  pageName: string;
}

// ---- Helpers ----

function resolveVariableName(binding: any): string | undefined {
  if (!binding || typeof binding !== 'object' || !('id' in binding)) return undefined;
  try {
    const variable = figma.variables.getVariableById(binding.id);
    return variable?.name;
  } catch {
    return undefined;
  }
}

function effectKey(e: Effect): string {
  const parts = [e.type.toLowerCase()];
  if ('radius' in e && e.radius) parts.push(`r${e.radius}`);
  if ('offset' in e && e.offset) parts.push(`${e.offset.x}x${e.offset.y}`);
  if ('color' in e && e.color) parts.push(rgbToHex(e.color.r, e.color.g, e.color.b));
  return parts.join(' ');
}

function typoKey(family: string, size: number, weight: number, lh?: number): string {
  return `${family}|${size}|${weight}|${lh ?? ''}`;
}

// ---- Main scanner ----

export function scanDesignSystem(): DesignSystemCache {
  const fillColors: Record<string, ColorEntry> = {};
  const strokeColors: Record<string, ColorEntry> = {};
  const typoMap = new Map<string, TypographyEntry>();
  const paddingCounts: Record<string, number> = {};
  const gapCounts: Record<string, number> = {};
  const radiiCounts: Record<string, number> = {};
  const effectCounts: Record<string, number> = {};
  const componentCounts = new Map<string, number>();
  let nodeCount = 0;

  function bumpColor(
    map: Record<string, ColorEntry>,
    hex: string,
    token?: string
  ) {
    if (!map[hex]) {
      map[hex] = { count: 0, token };
    }
    map[hex].count++;
    // Prefer a token name if we find one later
    if (token && !map[hex].token) {
      map[hex].token = token;
    }
  }

  function bumpCount(map: Record<string, number>, value: number) {
    const key = String(value);
    map[key] = (map[key] || 0) + 1;
  }

  function walk(node: SceneNode) {
    if (!node.visible) return;
    nodeCount++;

    // Bound variables for token resolution
    const bv: any =
      'boundVariables' in node ? (node as any).boundVariables : null;

    // ---- Fills ----
    if ('fills' in node && node.fills !== figma.mixed) {
      const fills = node.fills as readonly Paint[];
      for (const f of fills) {
        if (f.visible === false || f.type !== 'SOLID') continue;
        const hex = rgbToHex(f.color.r, f.color.g, f.color.b);
        const token = bv?.fills
          ? resolveVariableName(
              Array.isArray(bv.fills) ? bv.fills[0] : bv.fills
            )
          : undefined;
        bumpColor(fillColors, hex, token);
      }
    }

    // ---- Strokes ----
    if ('strokes' in node) {
      const strokes = node.strokes as readonly Paint[];
      for (const s of strokes) {
        if (s.visible === false || s.type !== 'SOLID') continue;
        const hex = rgbToHex(s.color.r, s.color.g, s.color.b);
        const token = bv?.strokes
          ? resolveVariableName(
              Array.isArray(bv.strokes) ? bv.strokes[0] : bv.strokes
            )
          : undefined;
        bumpColor(strokeColors, hex, token);
      }
    }

    // ---- Typography ----
    if (node.type === 'TEXT') {
      const t = node as TextNode;
      const family =
        t.fontName === figma.mixed ? 'mixed' : t.fontName.family;
      const size =
        t.fontSize === figma.mixed ? -1 : (t.fontSize as number);
      const weight =
        t.fontWeight === figma.mixed ? -1 : (t.fontWeight as number);
      let lh: number | undefined;
      if (t.lineHeight !== figma.mixed) {
        const lineH = t.lineHeight as LineHeight;
        if (lineH.unit !== 'AUTO') lh = Math.round(lineH.value * 100) / 100;
      }

      const key = typoKey(family, size, weight, lh);
      const existing = typoMap.get(key);
      if (existing) {
        existing.count++;
      } else {
        typoMap.set(key, { family, size, weight, lineHeight: lh, count: 1 });
      }
    }

    // ---- Spacing (auto-layout) ----
    if ('layoutMode' in node) {
      const frame = node as FrameNode;
      if (frame.layoutMode !== 'NONE') {
        if (frame.itemSpacing > 0) bumpCount(gapCounts, frame.itemSpacing);
        if (frame.paddingTop > 0) bumpCount(paddingCounts, frame.paddingTop);
        if (frame.paddingRight > 0) bumpCount(paddingCounts, frame.paddingRight);
        if (frame.paddingBottom > 0) bumpCount(paddingCounts, frame.paddingBottom);
        if (frame.paddingLeft > 0) bumpCount(paddingCounts, frame.paddingLeft);
      }
    }

    // ---- Corner radii ----
    if ('cornerRadius' in node) {
      if (node.cornerRadius !== figma.mixed && typeof node.cornerRadius === 'number' && node.cornerRadius > 0) {
        bumpCount(radiiCounts, node.cornerRadius);
      } else if (node.cornerRadius === figma.mixed) {
        // Collect individual corners
        for (const prop of ['topLeftRadius', 'topRightRadius', 'bottomRightRadius', 'bottomLeftRadius'] as const) {
          if (prop in node) {
            const val = (node as any)[prop];
            if (typeof val === 'number' && val > 0) bumpCount(radiiCounts, val);
          }
        }
      }
    }

    // ---- Effects ----
    if ('effects' in node) {
      const effects = node.effects as readonly Effect[];
      for (const e of effects) {
        if (e.visible === false) continue;
        const key = effectKey(e);
        effectCounts[key] = (effectCounts[key] || 0) + 1;
      }
    }

    // ---- Components ----
    if (node.type === 'INSTANCE') {
      // In dynamic-page mode, mainComponent may not be available synchronously.
      // Use the node name as a proxy (instances are named after their main component).
      const compName = node.name;
      componentCounts.set(compName, (componentCounts.get(compName) || 0) + 1);
    }

    // Recurse
    if ('children' in node) {
      for (const child of (node as ChildrenMixin).children as readonly SceneNode[]) {
        walk(child);
      }
    }
  }

  // Walk all top-level nodes on the current page
  for (const child of figma.currentPage.children) {
    walk(child);
  }

  // ---- Build sorted typography array ----
  const typography = Array.from(typoMap.values()).sort(
    (a, b) => b.count - a.count
  );

  // ---- Build sorted components array ----
  const components: ComponentEntry[] = Array.from(componentCounts.entries())
    .map(([name, instances]) => ({ name, instances }))
    .sort((a, b) => b.instances - a.instances);

  return {
    colors: { fills: fillColors, strokes: strokeColors },
    typography,
    spacing: { padding: paddingCounts, gap: gapCounts },
    radii: radiiCounts,
    effects: effectCounts,
    components,
    scannedAt: Date.now(),
    nodeCount,
    pageId: figma.currentPage.id,
    pageName: figma.currentPage.name,
  };
}

// ---- Compact text serialization for LLM context injection ----
// Produces a human-readable summary that's much cheaper than raw JSON.

export function cacheToPromptContext(cache: DesignSystemCache): string {
  const lines: string[] = [];
  lines.push(`DESIGN SYSTEM CONTEXT (scanned from "${cache.pageName}", ${cache.nodeCount} nodes):`);
  lines.push('');

  // Colors — token name first (hex in brackets), no usage counts
  const fillEntries = Object.entries(cache.colors.fills).sort(
    (a, b) => b[1].count - a[1].count
  );
  if (fillEntries.length > 0) {
    lines.push('FILL COLORS:');
    for (const [hex, entry] of fillEntries) {
      if (entry.token) {
        lines.push(`  ${entry.token} (${hex})`);
      } else {
        lines.push(`  ${hex}`);
      }
    }
    lines.push('');
  }

  const strokeEntries = Object.entries(cache.colors.strokes).sort(
    (a, b) => b[1].count - a[1].count
  );
  if (strokeEntries.length > 0) {
    lines.push('STROKE COLORS:');
    for (const [hex, entry] of strokeEntries) {
      if (entry.token) {
        lines.push(`  ${entry.token} (${hex})`);
      } else {
        lines.push(`  ${hex}`);
      }
    }
    lines.push('');
  }

  // Typography
  if (cache.typography.length > 0) {
    lines.push('TYPE SCALE (family / size / weight / lineHeight → usage count):');
    for (const t of cache.typography) {
      const lhPart = t.lineHeight != null ? ` / lh ${t.lineHeight}` : '';
      lines.push(`  ${t.family} ${t.size}px w${t.weight}${lhPart} ×${t.count}`);
    }
    lines.push('');
  }

  // Spacing
  const padEntries = Object.entries(cache.spacing.padding).sort(
    (a, b) => Number(a[0]) - Number(b[0])
  );
  const gapEntries = Object.entries(cache.spacing.gap).sort(
    (a, b) => Number(a[0]) - Number(b[0])
  );
  if (padEntries.length > 0 || gapEntries.length > 0) {
    lines.push('SPACING SCALE:');
    if (padEntries.length > 0) {
      lines.push(
        `  Padding values: ${padEntries.map(([v, c]) => `${v}px ×${c}`).join(', ')}`
      );
    }
    if (gapEntries.length > 0) {
      lines.push(
        `  Gap values: ${gapEntries.map(([v, c]) => `${v}px ×${c}`).join(', ')}`
      );
    }
    lines.push('');
  }

  // Radii
  const radiiEntries = Object.entries(cache.radii).sort(
    (a, b) => Number(a[0]) - Number(b[0])
  );
  if (radiiEntries.length > 0) {
    lines.push(
      `CORNER RADII: ${radiiEntries.map(([v, c]) => `${v}px ×${c}`).join(', ')}`
    );
    lines.push('');
  }

  // Effects
  const effectEntries = Object.entries(cache.effects).sort(
    (a, b) => b[1] - a[1]
  );
  if (effectEntries.length > 0) {
    lines.push('EFFECTS:');
    for (const [key, count] of effectEntries) {
      lines.push(`  ${key} ×${count}`);
    }
    lines.push('');
  }

  // Components
  if (cache.components.length > 0) {
    lines.push('COMPONENTS IN USE:');
    for (const c of cache.components.slice(0, 30)) {
      lines.push(`  ${c.name} ×${c.instances}`);
    }
    if (cache.components.length > 30) {
      lines.push(`  ... and ${cache.components.length - 30} more`);
    }
    lines.push('');
  }

  lines.push('Use this context to check whether the selected frame follows the design system. Flag deviations from these established patterns.');

  return lines.join('\n');
}

// ---- Storage helpers ----

const DS_CACHE_KEY = 'pair-designer-ds-cache';

export async function loadCachedDesignSystem(): Promise<DesignSystemCache | null> {
  try {
    const stored = await figma.clientStorage.getAsync(DS_CACHE_KEY);
    if (!stored || typeof stored !== 'object') return null;
    // Invalidate if page changed
    if (stored.pageId !== figma.currentPage.id) return null;
    return stored as DesignSystemCache;
  } catch {
    return null;
  }
}

export async function saveDesignSystemCache(cache: DesignSystemCache): Promise<void> {
  await figma.clientStorage.setAsync(DS_CACHE_KEY, cache);
}

// ---- Lightweight per-frame observer scan ----
// Walks a single frame and compares its properties against the cached DS.
// Returns local hints (no API call) about deviations.

export interface ObserverHint {
  type: 'color' | 'spacing' | 'typography' | 'radius';
  message: string;
}

export interface ObserverFix {
  id: string;            // unique id for this fix
  type: 'color' | 'spacing' | 'typography' | 'radius';
  nodeId: string;
  nodeName: string;
  property: string;      // e.g. 'fill', 'paddingTop', 'cornerRadius', 'fontSize'
  currentValue: string;  // human-readable current value
  suggestedValue: string; // human-readable suggested value
  fixData: object;       // opaque data the plugin uses to apply the fix
}

// ---- Nearest-token helpers ----

function nearestColor(hex: string, palette: Record<string, ColorEntry>): string | null {
  // Simple RGB distance — find closest palette color
  const parse = (h: string) => ({
    r: parseInt(h.slice(1, 3), 16),
    g: parseInt(h.slice(3, 5), 16),
    b: parseInt(h.slice(5, 7), 16),
  });
  const c = parse(hex);
  let best: string | null = null;
  let bestDist = Infinity;
  for (const paletteHex of Object.keys(palette)) {
    const p = parse(paletteHex);
    const dist = Math.abs(c.r - p.r) + Math.abs(c.g - p.g) + Math.abs(c.b - p.b);
    if (dist < bestDist) {
      bestDist = dist;
      best = paletteHex;
    }
  }
  return best;
}

function nearestNumber(val: number, allowed: Record<string, number>): number | null {
  const nums = Object.keys(allowed).map(Number);
  if (nums.length === 0) return null;
  let best = nums[0];
  let bestDist = Math.abs(val - best);
  for (const n of nums) {
    const d = Math.abs(val - n);
    if (d < bestDist) { bestDist = d; best = n; }
  }
  return best;
}

export interface QuickScanResult {
  hints: ObserverHint[];
  fixes: ObserverFix[];
}

let fixCounter = 0;

export function quickScanFrame(
  node: SceneNode,
  cache: DesignSystemCache
): QuickScanResult {
  const hints: ObserverHint[] = [];
  const fixes: ObserverFix[] = [];
  const offColors = new Set<string>();
  const offSpacing = new Set<string>();
  const offRadii = new Set<string>();
  const offTypo = new Set<string>();

  function walk(n: SceneNode) {
    // Check fills
    if ('fills' in n && n.fills !== figma.mixed) {
      const fills = n.fills as readonly Paint[];
      for (let fi = 0; fi < fills.length; fi++) {
        const f = fills[fi];
        if (f.visible === false || f.type !== 'SOLID') continue;
        const hex = rgbToHex(f.color.r, f.color.g, f.color.b);
        if (!cache.colors.fills[hex]) {
          offColors.add(hex);
          const nearest = nearestColor(hex, cache.colors.fills);
          if (nearest) {
            const token = cache.colors.fills[nearest].token;
            fixes.push({
              id: `fix-${++fixCounter}`,
              type: 'color',
              nodeId: n.id,
              nodeName: n.name,
              property: 'fill',
              currentValue: hex,
              suggestedValue: token ? `${token} (${nearest})` : nearest,
              fixData: { fillIndex: fi, hex: nearest },
            });
          }
        }
      }
    }

    // Check spacing (padding + gap)
    if ('paddingTop' in n) {
      const frame = n as FrameNode;
      const padProps = ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'] as const;
      const padVals = [frame.paddingTop, frame.paddingRight, frame.paddingBottom, frame.paddingLeft];
      for (let i = 0; i < padProps.length; i++) {
        const val = padVals[i];
        if (val > 0 && !cache.spacing.padding[String(val)]) {
          offSpacing.add(`${val}px padding`);
          const nearest = nearestNumber(val, cache.spacing.padding);
          if (nearest !== null) {
            fixes.push({
              id: `fix-${++fixCounter}`,
              type: 'spacing',
              nodeId: n.id,
              nodeName: n.name,
              property: padProps[i],
              currentValue: `${val}px`,
              suggestedValue: `${nearest}px`,
              fixData: { prop: padProps[i], value: nearest },
            });
          }
        }
      }
      if ('itemSpacing' in frame && frame.itemSpacing > 0 && !cache.spacing.gap[String(frame.itemSpacing)]) {
        offSpacing.add(`${frame.itemSpacing}px gap`);
        const nearest = nearestNumber(frame.itemSpacing, cache.spacing.gap);
        if (nearest !== null) {
          fixes.push({
            id: `fix-${++fixCounter}`,
            type: 'spacing',
            nodeId: n.id,
            nodeName: n.name,
            property: 'itemSpacing',
            currentValue: `${frame.itemSpacing}px`,
            suggestedValue: `${nearest}px`,
            fixData: { prop: 'itemSpacing', value: nearest },
          });
        }
      }
    }

    // Check corner radius
    if ('cornerRadius' in n) {
      const r = (n as any).cornerRadius;
      if (typeof r === 'number' && r > 0 && !cache.radii[String(r)]) {
        offRadii.add(`${r}px`);
        const nearest = nearestNumber(r, cache.radii);
        if (nearest !== null) {
          fixes.push({
            id: `fix-${++fixCounter}`,
            type: 'radius',
            nodeId: n.id,
            nodeName: n.name,
            property: 'cornerRadius',
            currentValue: `${r}px`,
            suggestedValue: `${nearest}px`,
            fixData: { prop: 'cornerRadius', value: nearest },
          });
        }
      }
    }

    // Check typography
    if (n.type === 'TEXT') {
      const t = n as TextNode;
      if (t.fontSize !== figma.mixed) {
        const size = t.fontSize as number;
        const family = t.fontName === figma.mixed ? null : t.fontName.family;
        const weight = t.fontWeight === figma.mixed ? null : (t.fontWeight as number);
        const matched = cache.typography.some(
          (entry) =>
            entry.size === size &&
            (!family || entry.family === family) &&
            (!weight || entry.weight === weight)
        );
        if (!matched && family) {
          offTypo.add(`${family} ${size}px`);
          // Find nearest font size in cache with same family
          let bestEntry = cache.typography[0];
          let bestDist = Infinity;
          for (const entry of cache.typography) {
            if (entry.family === family) {
              const d = Math.abs(entry.size - size);
              if (d < bestDist) { bestDist = d; bestEntry = entry; }
            }
          }
          if (bestEntry) {
            fixes.push({
              id: `fix-${++fixCounter}`,
              type: 'typography',
              nodeId: n.id,
              nodeName: n.name,
              property: 'fontSize',
              currentValue: `${size}px`,
              suggestedValue: `${bestEntry.size}px (w${bestEntry.weight})`,
              fixData: { size: bestEntry.size, weight: bestEntry.weight },
            });
          }
        }
      }
    }

    // Recurse
    if ('children' in n) {
      for (const child of (n as ChildrenMixin).children as readonly SceneNode[]) {
        walk(child);
      }
    }
  }

  walk(node);

  // Build summary hints (same as before)
  if (offColors.size > 0) {
    const examples = Array.from(offColors).slice(0, 3);
    hints.push({
      type: 'color',
      message: `${offColors.size} off-palette color${offColors.size > 1 ? 's' : ''}: ${examples.join(', ')}${offColors.size > 3 ? '...' : ''}`,
    });
  }

  if (offSpacing.size > 0) {
    const examples = Array.from(offSpacing).slice(0, 3);
    hints.push({
      type: 'spacing',
      message: `Non-standard spacing: ${examples.join(', ')}${offSpacing.size > 3 ? '...' : ''}`,
    });
  }

  if (offRadii.size > 0) {
    hints.push({
      type: 'radius',
      message: `Non-standard radii: ${Array.from(offRadii).join(', ')}`,
    });
  }

  if (offTypo.size > 0) {
    const examples = Array.from(offTypo).slice(0, 3);
    hints.push({
      type: 'typography',
      message: `Off-scale type: ${examples.join(', ')}${offTypo.size > 3 ? '...' : ''}`,
    });
  }

  return { hints, fixes };
}
