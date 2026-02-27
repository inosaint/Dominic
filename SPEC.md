# Pair Designer — Figma Plugin Spec

> A BYOK (Bring Your Own Key) Figma plugin that acts as an AI pair designer.
> Select a frame, ask a question via a chat window, and receive feedback as native Figma annotations attached to specific layers.

---

## 1. What This Plugin Does

The user selects a frame in Figma. They open the plugin, which shows a small chat interface. They type a design question or request a review — e.g. "Is the visual hierarchy clear?", "Check spacing consistency", "Review accessibility". The plugin extracts structured design data from the selected node tree, sends it (along with an optional screenshot) to an LLM API, and writes the feedback back as **native Figma annotations** on the relevant child nodes. Annotations are categorized under a custom "AI Review" category so they're filterable in Dev Mode.

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                    Figma Desktop                     │
│                                                      │
│  ┌──────────────┐       ┌─────────────────────────┐ │
│  │  Plugin Code  │◄────►│    Plugin UI (iframe)    │ │
│  │  (sandbox)    │ msg  │    Next.js / React       │ │
│  │               │      │                          │ │
│  │ - Read nodes  │      │ - Chat interface         │ │
│  │ - Extract data│      │ - Settings (API key)     │ │
│  │ - Write       │      │ - Review history         │ │
│  │   annotations │      │                          │ │
│  └──────┬───────┘       └──────────┬──────────────┘ │
│         │                          │                 │
└─────────│──────────────────────────│─────────────────┘
          │                          │
          │  (design data + screenshot passed via postMessage)
          │                          │
          │                 ┌────────▼────────┐
          │                 │  Server Route    │
          │                 │  /api/review     │
          │                 │                  │
          │                 │  Calls LLM API:  │
          │                 │  - Anthropic     │
          │                 │  - OpenAI        │
          │                 └────────┬─────────┘
          │                          │
          │    structured feedback    │
          │    (JSON array)          │
          │◄─────────────────────────┘
          │
          ▼
   Write annotations to
   specific child nodes
```

### Key Decisions

- **Framework**: Use Figma's official [AI plugin template](https://github.com/figma/ai-plugin-template) as the base. It's a Next.js app with a Figma plugin manifest, handles iframe ↔ plugin communication, and has a pattern for API key storage.
- **Output mechanism**: Native Figma **annotations** (not comments). Annotations are a first-class Plugin API feature, support markdown, custom categories with colors, and are visible/filterable in Dev Mode. Comments require the REST API + a separate Figma personal access token, which adds friction.
- **LLM provider**: Support both Anthropic (Claude) and OpenAI as selectable providers. Default to Anthropic.
- **Design data extraction**: Use `exportAsync({ format: 'JSON_REST_V1' })` for the full structured node tree, supplemented by a PNG screenshot for visual context.

---

## 3. Plugin Manifest

```json
{
  "name": "Pair Designer",
  "id": "pair-designer-ai-review",
  "api": "1.0.0",
  "main": "plugin/code.js",
  "ui": "plugin/ui.html",
  "editorType": ["figma"],
  "networkAccess": {
    "allowedDomains": [
      "https://api.anthropic.com",
      "https://api.openai.com",
      "https://localhost:3000"
    ],
    "reasoning": "LLM API calls for design review"
  },
  "documentAccess": "dynamic-page",
  "permissions": []
}
```

### Note on `documentAccess`

Using `"dynamic-page"` is recommended for performance with large files. This requires using async versions of node access methods (e.g. `getNodeByIdAsync`).

---

## 4. Design Data Extraction

This is the most important part of the plugin — the quality of the LLM's feedback depends entirely on the richness of the design context we provide.

### 4.1 Primary: Structured JSON via `exportAsync`

```typescript
const selectedNode = figma.currentPage.selection[0];
const jsonData = await selectedNode.exportAsync({
  format: 'JSON_REST_V1'
});
// jsonData.document contains the full node tree in REST API format
```

This gives us the complete node hierarchy with all properties — fills, strokes, effects, layout, text content, font sizes, constraints, etc. It's the same shape as the Figma REST API response.

### 4.2 Secondary: Screenshot for Visual Context

```typescript
const screenshotBytes = await selectedNode.exportAsync({
  format: 'PNG',
  constraint: { type: 'SCALE', value: 2 }
});
const base64Screenshot = figma.base64Encode(screenshotBytes);
```

The screenshot is sent alongside the structured data so the LLM can correlate visual appearance with the data. This is especially useful for layout review, visual hierarchy assessment, and catching issues the JSON alone might not convey.

### 4.3 Custom Extraction (Lightweight Alternative)

For faster reviews or to reduce token usage, build a lightweight extractor that walks the node tree and extracts only design-relevant properties:

```typescript
interface ExtractedNode {
  id: string;
  name: string;
  type: string;
  // Dimensions
  width: number;
  height: number;
  x: number;
  y: number;
  // Visual
  fills?: SolidColorSummary[];
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
```

Write a recursive `extractNode(node: SceneNode): ExtractedNode` function that walks the tree and returns this structure. Handle `figma.mixed` values by returning `'mixed'`.

### 4.4 Node ID Mapping

Critical: we need to map the LLM's feedback back to specific Figma nodes. The extracted data must preserve the `id` field (e.g. `"1:34"`) for each node. The LLM response must reference these IDs so we can write annotations to the correct layers.

---

## 5. LLM Integration

### 5.1 API Route

Create a server-side route at `/api/review` (Next.js API route) that:

1. Receives: `{ designData, screenshot?, userPrompt, provider, apiKey, reviewMode }`
2. Constructs a system prompt + user message
3. Calls the appropriate LLM API
4. Returns structured feedback as JSON

### 5.2 System Prompt

```
You are an expert UI/UX design reviewer embedded in Figma. You receive structured design data (a JSON node tree) and optionally a screenshot of a selected frame.

Your job is to review the design and provide specific, actionable feedback. Each piece of feedback must reference a specific node by its ID.

RESPONSE FORMAT:
Return a JSON array of feedback items. Each item has:
- "nodeId": string — the ID of the specific node this feedback applies to (from the design data). Use the top-level frame ID only if the feedback is about the overall layout.
- "feedback": string — concise, actionable feedback in markdown. Keep under 280 characters. Be specific: reference actual values (e.g. "Font size is 11px — consider 14px+ for body text readability").
- "category": one of "spacing", "typography", "color", "hierarchy", "accessibility", "layout", "consistency", "interaction", "general"
- "severity": one of "suggestion", "warning", "issue"

RULES:
- Be specific. Reference actual property values from the design data.
- Be actionable. Say what to change, not just what's wrong.
- Don't repeat information that's already obvious from the design.
- Prioritize issues by impact. Lead with the most important feedback.
- Limit to 8-12 items per review. Quality over quantity.
- If the user asked a specific question, focus your review on answering that question.

DESIGN CONTEXT:
{designData}

USER QUESTION:
{userPrompt}
```

### 5.3 Anthropic API Call

```typescript
const response = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01'
  },
  body: JSON.stringify({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{
      role: 'user',
      content: [
        // Include screenshot if available
        ...(screenshot ? [{
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/png',
            data: screenshot
          }
        }] : []),
        {
          type: 'text',
          text: userMessage
        }
      ]
    }]
  })
});
```

### 5.4 OpenAI API Call

```typescript
const response = await fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  },
  body: JSON.stringify({
    model: 'gpt-4o',
    max_tokens: 4096,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          ...(screenshot ? [{
            type: 'image_url',
            image_url: { url: `data:image/png;base64,${screenshot}` }
          }] : []),
          { type: 'text', text: userMessage }
        ]
      }
    ]
  })
});
```

### 5.5 Response Parsing

The LLM response is parsed into:

```typescript
interface ReviewItem {
  nodeId: string;
  feedback: string;
  category: 'spacing' | 'typography' | 'color' | 'hierarchy' |
            'accessibility' | 'layout' | 'consistency' |
            'interaction' | 'general';
  severity: 'suggestion' | 'warning' | 'issue';
}
```

Validate the response. If the LLM returns malformed JSON, attempt to extract it from markdown code fences. If `nodeId` values don't match any node in the file, fall back to the top-level selected frame.

---

## 6. Writing Annotations

### 6.1 Create Custom Annotation Category

On first run (or if the category doesn't exist yet), create a custom "AI Review" annotation category:

```typescript
async function getOrCreateAIReviewCategory(): Promise<string> {
  const categories = await figma.annotations.getAnnotationCategoriesAsync();

  // Check if our category already exists
  const existing = categories.find(c => c.label === 'AI Review');
  if (existing) return existing.id;

  // Create new category — violet stands out nicely
  const newCategory = await figma.annotations.addAnnotationCategoryAsync({
    label: 'AI Review',
    color: 'violet'  // Options: yellow, orange, red, pink, violet, blue, teal, green
  });

  return newCategory.id;
}
```

### 6.2 Write Feedback as Annotations

```typescript
async function writeAnnotations(
  reviewItems: ReviewItem[],
  categoryId: string
): Promise<{ written: number; skipped: number }> {
  let written = 0;
  let skipped = 0;

  for (const item of reviewItems) {
    const node = await figma.getNodeByIdAsync(item.nodeId);

    if (!node || !('annotations' in node)) {
      // Fall back to the selected frame
      const fallbackNode = figma.currentPage.selection[0];
      if (fallbackNode && 'annotations' in fallbackNode) {
        applyAnnotation(fallbackNode, item, categoryId);
        written++;
      } else {
        skipped++;
      }
      continue;
    }

    applyAnnotation(node, item, categoryId);
    written++;
  }

  return { written, skipped };
}

function applyAnnotation(
  node: SceneNode & { annotations: Annotation[] },
  item: ReviewItem,
  categoryId: string
): void {
  const severityIcon = {
    suggestion: '💡',
    warning: '⚠️',
    issue: '🔴'
  }[item.severity];

  const markdown = `${severityIcon} **${item.category}**\n\n${item.feedback}`;

  // Append to existing annotations (don't overwrite)
  const existing = [...node.annotations];
  existing.push({
    labelMarkdown: markdown,
    categoryId: categoryId
  });
  node.annotations = existing;
}
```

### 6.3 Clear Previous AI Annotations

Before writing new annotations from a fresh review, clear old AI Review annotations:

```typescript
async function clearAIAnnotations(rootNode: SceneNode, categoryId: string): Promise<void> {
  // Recursively walk the tree
  async function clearNode(node: SceneNode) {
    if ('annotations' in node) {
      const filtered = node.annotations.filter(
        a => a.categoryId !== categoryId
      );
      if (filtered.length !== node.annotations.length) {
        node.annotations = filtered;
      }
    }

    if ('children' in node) {
      for (const child of node.children) {
        await clearNode(child);
      }
    }
  }

  await clearNode(rootNode);
}
```

---

## 7. Plugin UI

### 7.1 Layout

The plugin UI is an iframe rendered by Next.js. Target size: **320px wide × 480px tall**.

```
┌──────────────────────────────────┐
│  Pair Designer            ⚙️     │  ← Header with settings gear
├──────────────────────────────────┤
│                                  │
│  Selected: "Card Component"      │  ← Shows current selection
│  Layers: 12 · 340×220px         │
│                                  │
├──────────────────────────────────┤
│                                  │
│  ┌─ Chat History ─────────────┐ │
│  │                             │ │
│  │  You: Review the spacing    │ │
│  │  and visual hierarchy       │ │
│  │                             │ │
│  │  AI: ✅ 8 annotations added │ │
│  │  3 issues · 2 warnings ·   │ │
│  │  3 suggestions              │ │
│  │                             │ │
│  └─────────────────────────────┘ │
│                                  │
├──────────────────────────────────┤
│                                  │
│  Quick prompts:                  │
│  [Review all] [Accessibility]    │
│  [Spacing] [Typography]          │
│                                  │
├──────────────────────────────────┤
│  ┌──────────────────────┐  ▶️   │  ← Text input + send
│  │ Ask about this frame  │       │
│  └──────────────────────┘       │
│  [☑ Include screenshot]         │  ← Toggle for visual context
│                                  │
└──────────────────────────────────┘
```

### 7.2 Settings Panel

Accessible via the gear icon:

- **API Provider**: Dropdown — `Anthropic` | `OpenAI`
- **API Key**: Password input, stored in `figma.clientStorage`
- **Model**: Auto-selected based on provider (claude-sonnet-4-20250514 / gpt-4o) with option to override
- **Include screenshot**: Checkbox (on by default). Sends a 2x PNG alongside structured data. Improves quality but uses more tokens.
- **Auto-clear previous**: Checkbox (on by default). Clears old AI Review annotations before writing new ones.
- **Clear all AI annotations**: Button. Removes all annotations in the "AI Review" category from the current selection tree.

### 7.3 Quick Prompts

Pre-built prompts that address common review needs:

| Label | Prompt |
|-------|--------|
| Review all | "Do a comprehensive design review covering hierarchy, spacing, typography, color, and accessibility." |
| Accessibility | "Review this design for accessibility issues: contrast ratios, touch targets, font sizes, color-only indicators, and screen reader order." |
| Spacing | "Check spacing consistency. Are margins, padding, and gaps following a consistent grid/scale? Flag any irregular spacing." |
| Typography | "Review the typography: font sizes, weights, line heights, and hierarchy. Is the type scale clear and consistent?" |
| Consistency | "Check for design consistency: are similar elements styled the same way? Are there any inconsistencies in spacing, colors, or component usage?" |
| Copy | "Review the UI copy: is it clear, concise, and consistent in tone? Flag any jargon, ambiguity, or missing labels." |

---

## 8. Communication Flow (iframe ↔ Plugin)

### 8.1 Message Types

```typescript
// iframe → Plugin (requests)
type UIToPluginMessage =
  | { type: 'GET_SELECTION' }
  | { type: 'RUN_REVIEW'; payload: { prompt: string; includeScreenshot: boolean } }
  | { type: 'CLEAR_ANNOTATIONS' }
  | { type: 'STORE_SETTINGS'; payload: Settings }
  | { type: 'GET_SETTINGS' };

// Plugin → iframe (responses)
type PluginToUIMessage =
  | { type: 'SELECTION_DATA'; payload: SelectionInfo | null }
  | { type: 'DESIGN_DATA_READY'; payload: { json: object; screenshot?: string } }
  | { type: 'ANNOTATIONS_WRITTEN'; payload: { written: number; skipped: number } }
  | { type: 'SETTINGS_LOADED'; payload: Settings }
  | { type: 'ERROR'; payload: { message: string } };
```

### 8.2 Flow for a Review

1. User types prompt or clicks quick prompt → UI sends `RUN_REVIEW`
2. Plugin receives message → extracts design data (JSON + optional PNG) → sends `DESIGN_DATA_READY` to UI
3. UI receives design data → calls `/api/review` with design data + prompt + API key
4. Server route calls LLM → returns structured feedback
5. UI receives feedback → sends it to plugin via `WRITE_ANNOTATIONS` (add this message type)
6. Plugin writes annotations → sends `ANNOTATIONS_WRITTEN` back
7. UI shows summary: "✅ 8 annotations added"

### 8.3 Selection Listener

```typescript
figma.on('selectionchange', () => {
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
      width: 'width' in node ? node.width : 0,
      height: 'height' in node ? node.height : 0,
      childCount: 'children' in node ? countDescendants(node) : 0
    }
  });
});
```

---

## 9. Settings Storage

Use `figma.clientStorage` to persist settings locally on the user's machine:

```typescript
// Store
await figma.clientStorage.setAsync('pair-designer-settings', {
  provider: 'anthropic',
  apiKey: 'sk-ant-...', // stored locally only
  model: 'claude-sonnet-4-20250514',
  includeScreenshot: true,
  autoClearPrevious: true
});

// Retrieve
const settings = await figma.clientStorage.getAsync('pair-designer-settings');
```

The API key never leaves the user's machine except when making the direct API call to the LLM provider.

---

## 10. Project Structure

```
pair-designer/
├── plugin/
│   ├── manifest.json
│   ├── code.ts                    ← Plugin sandbox code
│   ├── extractDesignData.ts       ← Node tree extraction logic
│   ├── annotationWriter.ts        ← Annotation creation logic
│   └── tsconfig.json
├── app/
│   ├── page.tsx                   ← Plugin UI (chat interface)
│   ├── components/
│   │   ├── ChatWindow.tsx         ← Chat history + input
│   │   ├── SelectionInfo.tsx      ← Shows current selection
│   │   ├── QuickPrompts.tsx       ← Quick prompt buttons
│   │   ├── SettingsPanel.tsx      ← API key + preferences
│   │   └── ReviewSummary.tsx      ← Shows annotation results
│   ├── api/
│   │   └── review/
│   │       └── route.ts           ← Server route for LLM calls
│   ├── lib/
│   │   ├── figmaAPI.ts            ← Helper for iframe → plugin calls
│   │   ├── prompts.ts             ← System prompts + quick prompts
│   │   ├── providers/
│   │   │   ├── anthropic.ts       ← Anthropic API client
│   │   │   └── openai.ts          ← OpenAI API client
│   │   └── parseResponse.ts       ← LLM response validation/parsing
│   └── layout.tsx
├── package.json
├── next.config.js
├── tailwind.config.js
└── tsconfig.json
```

---

## 11. Key Implementation Details

### 11.1 Token Budget Management

The `JSON_REST_V1` export of a complex frame can be very large. Implement a budget system:

1. **Estimate token count**: Rough heuristic — 1 token ≈ 4 characters of JSON
2. **If over budget** (e.g. >30,000 tokens): Fall back to the lightweight custom extraction (Section 4.3) instead of full JSON export
3. **Depth limiting**: For very deep trees, limit extraction to 4-5 levels deep
4. **Property pruning**: Strip properties that aren't useful for design review (e.g. `absoluteTransform`, `relativeTransform`, vector path data, image hashes)

```typescript
function pruneForReview(json: any): any {
  const STRIP_KEYS = [
    'absoluteTransform', 'relativeTransform', 'absoluteBoundingBox',
    'absoluteRenderBounds', 'fillGeometry', 'strokeGeometry',
    'vectorPaths', 'vectorNetwork', 'imageHash',
    'transitionNodeID', 'transitionDuration', 'transitionEasing'
  ];
  // Recursively remove these keys
  // Also collapse children arrays if depth > 5
}
```

### 11.2 Error Handling

- **No selection**: Show "Select a frame to start reviewing" in the UI
- **Invalid API key**: Catch 401/403 from LLM APIs → show "Invalid API key. Check your settings."
- **Rate limiting**: Catch 429 → show "Rate limited. Try again in a moment."
- **Malformed LLM response**: Attempt JSON extraction from markdown fences, fall back to showing raw response in chat
- **Node not found**: When a `nodeId` from the LLM doesn't match any node, attach the annotation to the parent frame with a note about the original target

### 11.3 Annotation Markdown Formatting

Annotations support markdown. Use this format for rich feedback:

```markdown
💡 **spacing**

Gap between title and subtitle is 24px but body text gap is 16px. Consider using a consistent 16px or 20px throughout for vertical rhythm.
```

Severity icons:
- `💡` = suggestion (nice to have)
- `⚠️` = warning (should fix)
- `🔴` = issue (must fix)

### 11.4 Supported Annotation Category Colors

The `AnnotationCategoryColor` type supports: `'yellow'`, `'orange'`, `'red'`, `'pink'`, `'violet'`, `'blue'`, `'teal'`, `'green'`.

Use `'violet'` for the primary "AI Review" category. If you want severity-based categories instead:
- `'green'` = suggestions
- `'orange'` = warnings
- `'red'` = issues

---

## 12. Development & Testing

### 12.1 Setup

```bash
# Clone the Figma AI plugin template
git clone https://github.com/figma/ai-plugin-template pair-designer
cd pair-designer
npm install

# Add Figma plugin typings
npm install --save-dev @figma/plugin-typings

# Start dev server
npm run dev
```

### 12.2 Load in Figma

1. Open Figma Desktop
2. Right-click canvas → Plugins → Development → Import plugin from manifest
3. Select `pair-designer/plugin/manifest.json`
4. The plugin UI will load from `localhost:3000`

### 12.3 Testing Checklist

- [ ] Plugin loads without errors
- [ ] Selection change updates the UI
- [ ] Settings persist after closing/reopening plugin
- [ ] API key stored and retrieved correctly
- [ ] Design data extracted for a simple frame (2-3 layers)
- [ ] Design data extracted for a complex frame (20+ layers)
- [ ] LLM returns valid JSON response
- [ ] Annotations written to correct nodes
- [ ] "AI Review" category created with violet color
- [ ] Annotations visible in Dev Mode
- [ ] Annotations filterable by "AI Review" category
- [ ] Clear annotations removes only AI Review annotations
- [ ] Auto-clear works before re-review
- [ ] Quick prompts trigger correct reviews
- [ ] Error states render correctly (no selection, bad key, rate limit)
- [ ] Screenshot toggle works (on/off)
- [ ] Large frame doesn't exceed token budget (fallback works)

---

## 13. Future Enhancements (Out of Scope for V1)

- **Streaming responses**: Stream LLM output to the chat window as it arrives
- **Conversation memory**: Multi-turn chat that remembers prior feedback context
- **Custom rules**: User-defined design system rules (e.g. "We use 8px grid", "Primary color is #1A73E8") stored in plugin data
- **Batch review**: Review multiple frames in sequence
- **Diff mode**: After making changes, re-review and show what improved
- **Export report**: Generate a markdown or PDF summary of all feedback
- **Figma comments (REST API)**: Optional mode that writes comments instead of annotations, for teams that prefer the comment workflow
- **FigJam support**: Add sticky notes with feedback instead of annotations

---

## 14. API Reference Quick Links

| Resource | URL |
|----------|-----|
| Figma AI Plugin Template | https://github.com/figma/ai-plugin-template |
| Plugin API: Annotations | https://developers.figma.com/docs/plugins/api/Annotation/ |
| Plugin API: Annotation Categories | https://developers.figma.com/docs/plugins/api/figma-annotations/ |
| Plugin API: addAnnotationCategoryAsync | https://developers.figma.com/docs/plugins/api/properties/figma-annotations-addannotationcategoryasync/ |
| Plugin API: exportAsync | https://developers.figma.com/docs/plugins/api/properties/nodes-exportasync/ |
| Plugin API: clientStorage | https://developers.figma.com/docs/plugins/api/figma-clientStorage/ |
| AnnotationCategoryColor values | `'yellow' \| 'orange' \| 'red' \| 'pink' \| 'violet' \| 'blue' \| 'teal' \| 'green'` |
| Anthropic Messages API | https://docs.anthropic.com/en/docs/api/messages |
| OpenAI Chat Completions API | https://platform.openai.com/docs/api-reference/chat |
