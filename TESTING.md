# Testing Guide — Pair Designer Plugin

## Prerequisites

1. **Figma Desktop** app installed (not the browser version — plugins loaded from local manifest require the desktop app)
2. **Node.js** (v18+) and **npm** installed
3. An **Anthropic** or **OpenAI** API key

## Manual Setup (Step by Step)

### 1. Install dependencies

```bash
cd /path/to/Dominic
npm install
```

### 2. Build the plugin sandbox code

The plugin sandbox (`plugin/code.ts`) must be bundled to plain JS before Figma can load it:

```bash
npm run build:plugin
```

This runs esbuild and produces `plugin/code.js`.

### 3. Start the dev server

The plugin UI is a Next.js app served at `http://localhost:3000`. The plugin iframe loads this URL.

```bash
npm run dev
```

This starts both the Next.js dev server and the esbuild watcher in parallel (via `concurrently`). If you prefer to run them separately:

```bash
# Terminal 1 — Next.js UI
npx next dev

# Terminal 2 — Plugin code watcher
npx esbuild plugin/code.ts --bundle --outfile=plugin/code.js --target=es2020 --format=iife --watch
```

### 4. Load the plugin in Figma

1. Open **Figma Desktop**
2. Open any design file (or create a new one)
3. Right-click on the canvas
4. Go to **Plugins > Development > Import plugin from manifest...**
5. Navigate to the project folder and select **`plugin/manifest.json`**
   - The manifest is at `<project-root>/plugin/manifest.json`
   - `main` points to `code.js` (same directory)
   - `ui` points to `ui.html` (same directory, which loads `http://localhost:3000` in an iframe)
6. The plugin should now appear under **Plugins > Development > Pair Designer**

### 5. Run the plugin

1. Right-click canvas > **Plugins > Development > Pair Designer**
2. The plugin panel opens — you should see the chat UI
3. Click the gear icon and enter your API key

### Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| `ENOENT: plugin/plugin/code.js` | Old manifest had doubled paths | Fixed — `manifest.json` now uses `"main": "code.js"` (relative to itself). Re-import the manifest in Figma. |
| Plugin UI is blank / white | Next.js dev server not running | Run `npm run dev` and make sure `http://localhost:3000` loads in your browser |
| "Cannot find module" errors in console | Dependencies not installed | Run `npm install` |
| Plugin not in menu after import | Figma cached old manifest | Go to **Plugins > Development > Manage plugins in development**, remove the old entry, and re-import |
| `code.js` not found | Plugin code not built | Run `npm run build:plugin` |

---

## Test Cases

### 1. Verify Output Mode Setting

1. Open the plugin
2. Click the gear icon to open Settings
3. Confirm **Output Mode** dropdown is visible with three options:
   - "Sticky notes on canvas" (default)
   - "Annotations (requires paid plan)"
   - "Both"
4. Change the output mode, close and reopen the plugin — verify it persists

### 2. Sticky Notes on Canvas (Default Mode)

1. Select a frame with several child layers
2. Ensure Output Mode is set to **"Sticky notes on canvas"**
3. Enter your API key in Settings
4. Type a prompt or click a quick prompt (e.g. "Review all")
5. Wait for the review to complete
6. **Verify**:
   - An "AI Review Notes" container frame appears to the **right** of the selected frame (80px gap)
   - The container has a light gray background with rounded corners and a subtle shadow
   - A title reads "AI Review · N items"
   - Individual cards are stacked vertically inside the container
   - Each card has:
     - A colored left stripe (red = issue, orange = warning, violet = suggestion)
     - A bold header like "Issue · Spacing"
     - Feedback body text
     - A gray "Node: X:Y" reference at the bottom
   - Cards are sorted by severity (issues first, then warnings, then suggestions)
7. The chat window should show a message like: "Found 5 items to review. 5 sticky notes added to canvas."

### 3. Auto-Clear Previous Sticky Notes

1. With "Auto-clear previous review output" checked in Settings
2. Run a review — sticky notes appear
3. Run another review on the same frame
4. **Verify**: the old "AI Review Notes" frame is removed before the new one is created (only one container visible)

### 4. Manual Clear

1. Run a review so sticky notes are on the canvas
2. Open Settings
3. Click **"Clear all AI review output"**
4. **Verify**: the "AI Review Notes" container is removed from the canvas
5. Chat shows "AI review output cleared."

### 5. Annotations Mode (Paid Plan)

1. Set Output Mode to **"Annotations (requires paid plan)"**
2. Run a review
3. **If on a paid plan with Dev Mode**: annotations appear on child nodes, no sticky notes created
4. **If on a free plan**: the plugin reports that annotations aren't supported (written: 0, annotationsSupported: false), no sticky notes created

### 6. Both Mode

1. Set Output Mode to **"Both"**
2. Run a review
3. **Verify**:
   - Sticky notes appear on the canvas
   - Annotations are attempted (succeed on paid plans, gracefully fail on free)
   - Chat shows both results

### 7. Sticky Note Visual Checks

| Element               | Expected                                            |
|----------------------|-----------------------------------------------------|
| Container background | Light gray (#F7F7F7)                                |
| Container corners    | 12px rounded                                        |
| Card spacing         | 12px between cards                                  |
| Issue stripe         | Red (#F24822), 4px wide                             |
| Warning stripe       | Orange (#F2994A), 4px wide                          |
| Suggestion stripe    | Violet (#7B61FF), 4px wide                          |
| Card background      | Tinted based on severity                            |
| Card corners         | 8px rounded                                         |
| Header font          | Inter Bold, 11px                                    |
| Body font            | Inter Regular, 12px, 18px line height               |
| Node ref font        | Inter Regular, 10px, gray                           |
| Card content width   | 240px fixed                                         |
| Shadows              | Subtle drop shadows on container and individual cards|

### 8. Edge Cases

- **No selection**: Click "Clear all AI review output" with nothing selected — should show an error in the chat
- **Empty review**: If the LLM returns no issues, no sticky notes should be created
- **Large review**: 12 items — all should render and the container should auto-size vertically
- **Nested frame**: Select a frame inside another frame — sticky notes should appear as a sibling in the same parent

### 9. Settings Persistence

1. Set output mode to "Both"
2. Close the plugin
3. Reopen the plugin
4. Open Settings — output mode should still be "Both"
