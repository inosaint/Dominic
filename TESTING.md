# Testing Guide — Sticky Notes Feature

## Prerequisites

1. Figma Desktop app installed
2. Node.js and npm available
3. An Anthropic or OpenAI API key

## Setup

```bash
npm install
npm run dev
```

Load the plugin in Figma:
1. Right-click on the canvas
2. **Plugins > Development > Import plugin from manifest**
3. Select `plugin/manifest.json`
4. The plugin UI loads from `localhost:3000`

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
