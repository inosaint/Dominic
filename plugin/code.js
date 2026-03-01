"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __defProps = Object.defineProperties;
  var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
  var __getOwnPropSymbols = Object.getOwnPropertySymbols;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __propIsEnum = Object.prototype.propertyIsEnumerable;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __spreadValues = (a, b) => {
    for (var prop in b || (b = {}))
      if (__hasOwnProp.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    if (__getOwnPropSymbols)
      for (var prop of __getOwnPropSymbols(b)) {
        if (__propIsEnum.call(b, prop))
          __defNormalProp(a, prop, b[prop]);
      }
    return a;
  };
  var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));

  // plugin/extractDesignData.ts
  function rgbToHex(r, g, b) {
    const toHex = (c) => Math.round(c * 255).toString(16).padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }
  function extractFills(node) {
    if (!("fills" in node) || node.fills === figma.mixed)
      return void 0;
    const fills = node.fills;
    if (fills.length === 0)
      return void 0;
    return fills.filter((f) => f.visible !== false).map((f) => {
      const summary = { type: f.type };
      if (f.type === "SOLID") {
        summary.color = rgbToHex(f.color.r, f.color.g, f.color.b);
        if (f.opacity !== void 0 && f.opacity < 1) {
          summary.opacity = Math.round(f.opacity * 100) / 100;
        }
      }
      return summary;
    });
  }
  function extractStrokes(node) {
    if (!("strokes" in node))
      return void 0;
    const strokes = node.strokes;
    if (strokes.length === 0)
      return void 0;
    return strokes.filter((s) => s.visible !== false).map((s) => {
      const summary = { type: s.type };
      if (s.type === "SOLID") {
        summary.color = rgbToHex(s.color.r, s.color.g, s.color.b);
      }
      if ("strokeWeight" in node && typeof node.strokeWeight === "number") {
        summary.weight = node.strokeWeight;
      }
      return summary;
    });
  }
  function extractEffects(node) {
    if (!("effects" in node))
      return void 0;
    const effects = node.effects;
    if (effects.length === 0)
      return void 0;
    return effects.filter((e) => e.visible !== false).map((e) => {
      const summary = { type: e.type };
      if ("radius" in e)
        summary.radius = e.radius;
      if ("color" in e && e.color) {
        summary.color = rgbToHex(e.color.r, e.color.g, e.color.b);
      }
      if ("offset" in e && e.offset) {
        summary.offset = { x: e.offset.x, y: e.offset.y };
      }
      return summary;
    });
  }
  function extractCornerRadius(node) {
    if (!("cornerRadius" in node))
      return void 0;
    if (node.cornerRadius === figma.mixed) {
      if ("topLeftRadius" in node && "topRightRadius" in node && "bottomRightRadius" in node && "bottomLeftRadius" in node) {
        return [
          node.topLeftRadius,
          node.topRightRadius,
          node.bottomRightRadius,
          node.bottomLeftRadius
        ];
      }
      return void 0;
    }
    if (typeof node.cornerRadius !== "number")
      return void 0;
    return node.cornerRadius > 0 ? node.cornerRadius : void 0;
  }
  function extractNode(node, depth = 0, maxDepth = 5) {
    const extracted = {
      id: node.id,
      name: node.name,
      type: node.type,
      width: "width" in node ? Math.round(node.width) : 0,
      height: "height" in node ? Math.round(node.height) : 0,
      x: Math.round(node.x),
      y: Math.round(node.y)
    };
    const fills = extractFills(node);
    if (fills)
      extracted.fills = fills;
    const strokes = extractStrokes(node);
    if (strokes)
      extracted.strokes = strokes;
    const cornerRadius = extractCornerRadius(node);
    if (cornerRadius !== void 0)
      extracted.cornerRadius = cornerRadius;
    if ("opacity" in node && node.opacity < 1) {
      extracted.opacity = Math.round(node.opacity * 100) / 100;
    }
    const effects = extractEffects(node);
    if (effects)
      extracted.effects = effects;
    if (node.type === "TEXT") {
      const textNode = node;
      extracted.characters = textNode.characters;
      extracted.charCount = textNode.characters.length;
      extracted.fontSize = textNode.fontSize === figma.mixed ? "mixed" : textNode.fontSize;
      extracted.fontFamily = textNode.fontName === figma.mixed ? "mixed" : textNode.fontName.family;
      extracted.fontWeight = textNode.fontWeight === figma.mixed ? "mixed" : textNode.fontWeight;
      if (textNode.lineHeight !== figma.mixed) {
        const lh = textNode.lineHeight;
        if (lh.unit !== "AUTO") {
          extracted.lineHeight = { value: lh.value, unit: lh.unit };
        }
      } else {
        extracted.lineHeight = "mixed";
      }
      extracted.textAlignHorizontal = textNode.textAlignHorizontal;
      extracted.textAlignVertical = textNode.textAlignVertical;
      extracted.textAutoResize = textNode.textAutoResize;
      if ("textTruncation" in textNode) {
        extracted.textTruncation = textNode.textTruncation;
      }
      if ("maxLines" in textNode && textNode.maxLines != null) {
        extracted.maxLines = textNode.maxLines;
      }
    }
    if ("layoutMode" in node) {
      const frame = node;
      if (frame.layoutMode !== "NONE") {
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
    if ("boundVariables" in node) {
      const bv = node.boundVariables;
      if (bv && typeof bv === "object") {
        const bindings = {};
        for (const [prop, binding] of Object.entries(bv)) {
          if (binding && typeof binding === "object" && "id" in binding) {
            try {
              const variable = figma.variables.getVariableById(binding.id);
              if (variable) {
                bindings[prop] = variable.name;
              }
            } catch (_e) {
            }
          }
        }
        if (Object.keys(bindings).length > 0) {
          extracted.boundVariables = bindings;
        }
      }
    }
    if (node.type === "COMPONENT") {
      extracted.isComponent = true;
    } else if (node.type === "INSTANCE") {
      extracted.isInstance = true;
    }
    if ("children" in node && depth < maxDepth) {
      const children = node.children;
      const visibleChildren = children.filter((child) => child.visible);
      if (visibleChildren.length > 0) {
        extracted.children = visibleChildren.map(
          (child) => extractNode(child, depth + 1, maxDepth)
        );
      }
    }
    return extracted;
  }
  function countDescendants(node) {
    let count = 0;
    if ("children" in node) {
      const children = node.children;
      count += children.length;
      for (const child of children) {
        count += countDescendants(child);
      }
    }
    return count;
  }
  var TOKEN_BUDGET = 3e4;
  var CHARS_PER_TOKEN = 4;
  function estimateTokens(data) {
    return Math.ceil(JSON.stringify(data).length / CHARS_PER_TOKEN);
  }
  function pruneForReview(json) {
    const STRIP_KEYS = /* @__PURE__ */ new Set([
      "absoluteTransform",
      "relativeTransform",
      "absoluteBoundingBox",
      "absoluteRenderBounds",
      "fillGeometry",
      "strokeGeometry",
      "vectorPaths",
      "vectorNetwork",
      "imageHash",
      "transitionNodeID",
      "transitionDuration",
      "transitionEasing",
      "exportSettings",
      "pluginData",
      "sharedPluginData",
      "componentPropertyDefinitions",
      "componentPropertyReferences"
    ]);
    function prune(obj, depth) {
      if (obj === null || typeof obj !== "object")
        return obj;
      if (Array.isArray(obj)) {
        return obj.filter((item) => {
          if (item && typeof item === "object" && item.visible === false)
            return false;
          return true;
        }).map((item) => prune(item, depth));
      }
      const result = {};
      for (const [key, value] of Object.entries(obj)) {
        if (STRIP_KEYS.has(key))
          continue;
        if (key === "children" && depth > 5) {
          result[key] = `[${value.length} children omitted]`;
          continue;
        }
        result[key] = prune(value, key === "children" ? depth + 1 : depth);
      }
      return result;
    }
    return prune(json, 0);
  }
  async function getDesignData(node, includeScreenshot) {
    let jsonData;
    try {
      const rawJson = await node.exportAsync({ format: "JSON_REST_V1" });
      jsonData = pruneForReview(rawJson);
    } catch (_e) {
      jsonData = extractNode(node);
    }
    if (estimateTokens(jsonData) > TOKEN_BUDGET) {
      jsonData = extractNode(node);
    }
    let screenshot;
    if (includeScreenshot) {
      try {
        const bytes = await node.exportAsync({
          format: "PNG",
          constraint: { type: "SCALE", value: 2 }
        });
        screenshot = figma.base64Encode(bytes);
      } catch (_e) {
      }
    }
    return { json: jsonData, screenshot };
  }

  // plugin/annotationWriter.ts
  async function getOrCreateAIReviewCategory() {
    const categories = await figma.annotations.getAnnotationCategoriesAsync();
    const existing = categories.find((c) => c.label === "AI Review");
    if (existing)
      return existing.id;
    const newCategory = await figma.annotations.addAnnotationCategoryAsync({
      label: "AI Review",
      color: "violet"
    });
    return newCategory.id;
  }
  function applyAnnotation(node, item, categoryId) {
    const severityIcon = {
      suggestion: "\u{1F4A1}",
      warning: "\u26A0\uFE0F",
      issue: "\u{1F534}"
    };
    const icon = severityIcon[item.severity] || "\u{1F4A1}";
    const markdown = `${icon} **${item.category}**

${item.feedback}`;
    const existing = [...node.annotations];
    existing.push({
      labelMarkdown: markdown,
      categoryId
    });
    node.annotations = existing;
  }
  async function writeAnnotations(reviewItems, categoryId) {
    let written = 0;
    let skipped = 0;
    for (const item of reviewItems) {
      const node = await figma.getNodeByIdAsync(item.nodeId);
      if (!node || !("annotations" in node)) {
        const fallbackNode = figma.currentPage.selection[0];
        if (fallbackNode && "annotations" in fallbackNode) {
          applyAnnotation(
            fallbackNode,
            item,
            categoryId
          );
          written++;
        } else {
          skipped++;
        }
        continue;
      }
      applyAnnotation(
        node,
        item,
        categoryId
      );
      written++;
    }
    return { written, skipped };
  }
  async function clearAIAnnotations(rootNode, categoryId) {
    async function clearNode(node) {
      if ("annotations" in node) {
        const annotations = node.annotations;
        const filtered = annotations.filter((a) => a.categoryId !== categoryId);
        if (filtered.length !== annotations.length) {
          node.annotations = filtered;
        }
      }
      if ("children" in node) {
        const children = node.children;
        for (const child of children) {
          await clearNode(child);
        }
      }
    }
    await clearNode(rootNode);
  }

  // plugin/stickyNoteWriter.ts
  var SEVERITY_COLORS = {
    issue: {
      bg: { r: 0.95, g: 0.28, b: 0.13 },
      // #F24822
      glow: { r: 0.95, g: 0.28, b: 0.13, a: 0.5 },
      text: { r: 1, g: 1, b: 1 }
    },
    warning: {
      bg: { r: 0.95, g: 0.6, b: 0.07 },
      // #F29912
      glow: { r: 0.95, g: 0.6, b: 0.07, a: 0.5 },
      text: { r: 1, g: 1, b: 1 }
    },
    suggestion: {
      bg: { r: 0.48, g: 0.38, b: 1 },
      // #7B61FF
      glow: { r: 0.48, g: 0.38, b: 1, a: 0.5 },
      text: { r: 1, g: 1, b: 1 }
    }
  };
  var SEVERITY_EMOJI = {
    issue: "\u{1F534}",
    warning: "\u26A0\uFE0F",
    suggestion: "\u{1F4A1}"
  };
  var CATEGORY_LABELS = {
    spacing: "Spacing",
    typography: "Typography",
    color: "Color",
    hierarchy: "Hierarchy",
    accessibility: "Accessibility",
    layout: "Layout",
    consistency: "Consistency",
    interaction: "Interaction",
    i18n: "Localization",
    tokens: "Tokens",
    general: "General"
  };
  var MARKER_SIZE = 32;
  var NOTE_WIDTH = 240;
  var NOTE_GAP = 10;
  var NOTES_OFFSET_X = 60;
  async function loadFonts() {
    await Promise.all([
      figma.loadFontAsync({ family: "Inter", style: "Regular" }),
      figma.loadFontAsync({ family: "Inter", style: "Bold" })
    ]);
  }
  function createMarker(item, index) {
    const colors = SEVERITY_COLORS[item.severity] || SEVERITY_COLORS.suggestion;
    const marker = figma.createFrame();
    marker.name = `AI Review #${index + 1}: ${item.category} (${item.severity})`;
    marker.resize(MARKER_SIZE, MARKER_SIZE);
    marker.cornerRadius = MARKER_SIZE / 2;
    marker.fills = [{ type: "SOLID", color: colors.bg }];
    marker.clipsContent = false;
    marker.effects = [
      // Glow: colored outer shadow, no offset
      {
        type: "DROP_SHADOW",
        color: colors.glow,
        offset: { x: 0, y: 0 },
        radius: 16,
        visible: true,
        blendMode: "NORMAL"
      },
      // Background blur
      {
        type: "BACKGROUND_BLUR",
        blurType: "NORMAL",
        radius: 8,
        visible: true
      }
    ];
    marker.layoutMode = "HORIZONTAL";
    marker.primaryAxisSizingMode = "FIXED";
    marker.counterAxisSizingMode = "FIXED";
    marker.primaryAxisAlignItems = "CENTER";
    marker.counterAxisAlignItems = "CENTER";
    const label = figma.createText();
    label.fontName = { family: "Inter", style: "Bold" };
    label.characters = String(index + 1);
    label.fontSize = index < 9 ? 14 : 11;
    label.fills = [{ type: "SOLID", color: colors.text }];
    label.textAlignHorizontal = "CENTER";
    label.textAlignVertical = "CENTER";
    marker.appendChild(label);
    marker.setPluginData("ai-review-note", "1");
    marker.setPluginData("ai-review-index", String(index));
    marker.setPluginData("ai-review-nodeId", item.nodeId);
    return marker;
  }
  function createNoteCard(item, index) {
    const colors = SEVERITY_COLORS[item.severity] || SEVERITY_COLORS.suggestion;
    const emoji = SEVERITY_EMOJI[item.severity] || "\u{1F4A1}";
    const catLabel = CATEGORY_LABELS[item.category] || item.category;
    const card = figma.createFrame();
    card.name = `AI Note #${index + 1}: ${catLabel}`;
    card.resize(NOTE_WIDTH, 1);
    card.cornerRadius = 8;
    card.fills = [{ type: "SOLID", color: { r: 0.12, g: 0.12, b: 0.14 }, opacity: 0.92 }];
    card.effects = [
      {
        type: "BACKGROUND_BLUR",
        blurType: "NORMAL",
        radius: 12,
        visible: true
      },
      {
        type: "DROP_SHADOW",
        color: { r: 0, g: 0, b: 0, a: 0.2 },
        offset: { x: 0, y: 2 },
        radius: 8,
        spread: 0,
        visible: true,
        blendMode: "NORMAL"
      }
    ];
    card.layoutMode = "VERTICAL";
    card.primaryAxisSizingMode = "AUTO";
    card.counterAxisSizingMode = "FIXED";
    card.paddingTop = 8;
    card.paddingRight = 10;
    card.paddingBottom = 8;
    card.paddingLeft = 10;
    card.itemSpacing = 4;
    const header = figma.createText();
    header.fontName = { family: "Inter", style: "Bold" };
    header.characters = `${emoji} ${catLabel}`;
    header.fontSize = 11;
    header.fills = [{ type: "SOLID", color: colors.bg }];
    card.appendChild(header);
    header.layoutSizingHorizontal = "FILL";
    const feedbackText = item.feedback.length > 120 ? item.feedback.slice(0, 117) + "..." : item.feedback;
    const body = figma.createText();
    body.fontName = { family: "Inter", style: "Regular" };
    body.characters = feedbackText;
    body.fontSize = 11;
    body.lineHeight = { value: 16, unit: "PIXELS" };
    body.fills = [{ type: "SOLID", color: { r: 0.88, g: 0.88, b: 0.9 } }];
    card.appendChild(body);
    body.layoutSizingHorizontal = "FILL";
    card.setPluginData("ai-review-note", "1");
    card.setPluginData("ai-review-index", String(index));
    card.setPluginData("ai-review-nodeId", item.nodeId);
    return card;
  }
  function createConnectorLine(x1, y1, x2, y2, color) {
    const minX = Math.min(x1, x2);
    const minY = Math.min(y1, y2);
    const line = figma.createVector();
    line.name = "Connector";
    line.vectorPaths = [{
      windingRule: "NONE",
      data: `M ${x1 - minX} ${y1 - minY} L ${x2 - minX} ${y1 - minY} L ${x2 - minX} ${y2 - minY}`
    }];
    line.x = minX;
    line.y = minY;
    line.strokes = [{ type: "SOLID", color, opacity: 0.4 }];
    line.strokeWeight = 1;
    line.dashPattern = [3, 2];
    line.fills = [];
    line.setPluginData("ai-review-note", "1");
    return line;
  }
  async function writeStickyNotes(reviewItems, anchorNode) {
    var _a;
    await loadFonts();
    const sorted = [...reviewItems].sort((a, b) => {
      var _a2, _b;
      const order = { issue: 0, warning: 1, suggestion: 2 };
      return ((_a2 = order[a.severity]) != null ? _a2 : 3) - ((_b = order[b.severity]) != null ? _b : 3);
    });
    function getAbsoluteXY(node) {
      const transform = node.absoluteTransform;
      return {
        x: transform[0][2],
        y: transform[1][2],
        width: "width" in node ? node.width : 0,
        height: "height" in node ? node.height : 0
      };
    }
    const anchorBounds = getAbsoluteXY(anchorNode);
    const allNodes = [];
    const cardsPerNode = /* @__PURE__ */ new Map();
    const entries = [];
    for (let i = 0; i < sorted.length; i++) {
      const item = sorted[i];
      const colors = SEVERITY_COLORS[item.severity] || SEVERITY_COLORS.suggestion;
      const marker = createMarker(item, i);
      figma.currentPage.appendChild(marker);
      const note = createNoteCard(item, i);
      figma.currentPage.appendChild(note);
      const target = await figma.getNodeByIdAsync(item.nodeId);
      const targetNode = target && target.type !== "PAGE" && target.type !== "DOCUMENT" ? target : null;
      const anchor = targetNode ? getAbsoluteXY(targetNode) : anchorBounds;
      const stackIndex = (_a = cardsPerNode.get(item.nodeId)) != null ? _a : 0;
      cardsPerNode.set(item.nodeId, stackIndex + 1);
      marker.x = anchor.x + anchor.width - MARKER_SIZE / 2 + stackIndex * (MARKER_SIZE + 4);
      marker.y = anchor.y - MARKER_SIZE / 2;
      entries.push({ marker, note, color: colors.bg });
      allNodes.push(marker);
    }
    const noteColumnX = anchorBounds.x + anchorBounds.width + NOTES_OFFSET_X;
    let noteY = anchorBounds.y;
    for (const { marker, note, color } of entries) {
      note.x = noteColumnX;
      note.y = noteY;
      const noteHeight = Math.max(note.height, 50);
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
    if (allNodes.length > 0) {
      const group = figma.group(allNodes, figma.currentPage);
      group.name = "AI Review Notes";
      group.locked = false;
      group.setPluginData("ai-review-note", "1");
    }
    return { created: entries.length };
  }
  function dismissReviewItem(index) {
    const target = String(index);
    let removed = false;
    function searchIn(root) {
      if (!("children" in root))
        return;
      const children = [...root.children];
      for (const child of children) {
        if (child.getPluginData("ai-review-index") === target) {
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
  async function clearStickyNotes(parent) {
    let removed = 0;
    const seen = /* @__PURE__ */ new Set();
    function removeFrom(root) {
      if (!("children" in root))
        return;
      const children = [...root.children];
      for (const child of children) {
        if (seen.has(child.id))
          continue;
        seen.add(child.id);
        const isReviewNote = child.name.startsWith("AI Review #") || child.name.startsWith("AI Review Note:") || child.name.startsWith("AI Note #") || child.name === "AI Review Notes" || child.name === "Connector" || child.getPluginData("ai-review-note") === "1";
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

  // plugin/code.ts
  var STORAGE_KEY = "pair-designer-settings";
  figma.showUI(__html__, { width: 360, height: 640, themeColors: true });
  figma.on("selectionchange", () => {
    sendSelectionData();
    checkForMarkerSelection();
  });
  function sendSelectionData() {
    const selection = figma.currentPage.selection;
    if (selection.length === 0) {
      figma.ui.postMessage({ type: "SELECTION_DATA", payload: null });
      return;
    }
    const node = selection[0];
    const payload = {
      id: node.id,
      name: node.name,
      type: node.type,
      width: "width" in node ? Math.round(node.width) : 0,
      height: "height" in node ? Math.round(node.height) : 0,
      childCount: countDescendants(node)
    };
    figma.ui.postMessage({ type: "SELECTION_DATA", payload });
    if ("exportAsync" in node) {
      node.exportAsync({
        format: "PNG",
        constraint: { type: "WIDTH", value: 64 }
      }).then((bytes) => {
        const base64 = figma.base64Encode(bytes);
        figma.ui.postMessage({
          type: "SELECTION_DATA",
          payload: __spreadProps(__spreadValues({}, payload), { thumbnail: `data:image/png;base64,${base64}` })
        });
      }).catch(() => {
      });
    }
  }
  function checkForMarkerSelection() {
    const selection = figma.currentPage.selection;
    if (selection.length !== 1)
      return;
    const node = selection[0];
    if (node.getPluginData("ai-review-note") !== "1")
      return;
    const indexStr = node.getPluginData("ai-review-index");
    const nodeId = node.getPluginData("ai-review-nodeId");
    if (indexStr && nodeId) {
      figma.ui.postMessage({
        type: "MARKER_SELECTED",
        payload: { index: parseInt(indexStr, 10), nodeId }
      });
    }
  }
  figma.ui.onmessage = async (msg) => {
    try {
      switch (msg.type) {
        case "GET_SELECTION": {
          sendSelectionData();
          break;
        }
        case "RUN_REVIEW": {
          const selection = figma.currentPage.selection;
          if (selection.length === 0) {
            figma.ui.postMessage({
              type: "ERROR",
              payload: { message: "No frame selected. Select a frame to review." }
            });
            return;
          }
          const node = selection[0];
          figma.ui.postMessage({
            type: "SELECTION_DATA",
            payload: {
              id: node.id,
              name: node.name,
              type: node.type,
              width: "width" in node ? Math.round(node.width) : 0,
              height: "height" in node ? Math.round(node.height) : 0,
              childCount: countDescendants(node)
            }
          });
          const { json, screenshot } = await getDesignData(
            node,
            msg.payload.includeScreenshot
          );
          figma.ui.postMessage({
            type: "DESIGN_DATA_READY",
            payload: { json, screenshot }
          });
          break;
        }
        case "WRITE_ANNOTATIONS": {
          const selection = figma.currentPage.selection;
          const settings = await figma.clientStorage.getAsync(STORAGE_KEY);
          const outputMode = (settings == null ? void 0 : settings.outputMode) || "annotations";
          const useAnnotations = outputMode === "annotations" || outputMode === "both";
          const useStickyNotes = outputMode === "sticky-notes" || outputMode === "both";
          if (useAnnotations) {
            try {
              const categoryId = await getOrCreateAIReviewCategory();
              if ((settings == null ? void 0 : settings.autoClearPrevious) && selection.length > 0) {
                await clearAIAnnotations(selection[0], categoryId);
              }
              const { written, skipped } = await writeAnnotations(
                msg.payload.reviewItems,
                categoryId
              );
              figma.ui.postMessage({
                type: "ANNOTATIONS_WRITTEN",
                payload: { written, skipped, annotationsSupported: true }
              });
            } catch (_e) {
              figma.ui.postMessage({
                type: "ANNOTATIONS_WRITTEN",
                payload: {
                  written: 0,
                  skipped: msg.payload.reviewItems.length,
                  annotationsSupported: false
                }
              });
            }
          }
          if (useStickyNotes && selection.length > 0) {
            if (settings == null ? void 0 : settings.autoClearPrevious) {
              const parent = selection[0].parent || figma.currentPage;
              await clearStickyNotes(parent);
            }
            const { created } = await writeStickyNotes(
              msg.payload.reviewItems,
              selection[0]
            );
            figma.ui.postMessage({
              type: "STICKY_NOTES_WRITTEN",
              payload: { created }
            });
          }
          break;
        }
        case "CLEAR_ANNOTATIONS": {
          const selection = figma.currentPage.selection;
          if (selection.length === 0) {
            figma.ui.postMessage({
              type: "ERROR",
              payload: { message: "No frame selected. Select a frame to clear." }
            });
            return;
          }
          try {
            const categoryId = await getOrCreateAIReviewCategory();
            await clearAIAnnotations(selection[0], categoryId);
          } catch (_e) {
          }
          const parent = selection[0].parent || figma.currentPage;
          await clearStickyNotes(parent);
          figma.ui.postMessage({ type: "ANNOTATIONS_CLEARED" });
          break;
        }
        case "STORE_SETTINGS": {
          await figma.clientStorage.setAsync(STORAGE_KEY, msg.payload);
          break;
        }
        case "FOCUS_NODE": {
          const targetId = msg.payload.nodeId;
          const targetNode = await figma.getNodeByIdAsync(targetId);
          if (targetNode && targetNode.type !== "PAGE" && targetNode.type !== "DOCUMENT") {
            const sceneNode = targetNode;
            figma.currentPage.selection = [sceneNode];
            figma.viewport.scrollAndZoomIntoView([sceneNode]);
          }
          break;
        }
        case "DISMISS_REVIEW_ITEM": {
          dismissReviewItem(msg.payload.index);
          figma.ui.postMessage({
            type: "ITEM_DISMISSED",
            payload: { index: msg.payload.index }
          });
          break;
        }
        case "GET_SETTINGS": {
          const stored = await figma.clientStorage.getAsync(STORAGE_KEY);
          const defaults = {
            provider: "anthropic",
            apiKey: "",
            model: "claude-sonnet-4-6-20250514",
            includeScreenshot: true,
            autoClearPrevious: true,
            outputMode: "sticky-notes"
          };
          figma.ui.postMessage({
            type: "SETTINGS_LOADED",
            payload: stored ? __spreadValues(__spreadValues({}, defaults), stored) : defaults
          });
          break;
        }
      }
    } catch (err) {
      figma.ui.postMessage({
        type: "ERROR",
        payload: { message: (err == null ? void 0 : err.message) || "An unexpected error occurred." }
      });
    }
  };
  sendSelectionData();
})();
