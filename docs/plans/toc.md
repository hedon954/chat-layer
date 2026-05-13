# Codex Prompt: Implement A Floating TOC Panel

## Task Overview

Add a floating, draggable table of contents panel to this Manifest V3 Chrome
extension. On ChatGPT and Gemini pages, the panel should automatically extract
`h1`-`h6` headings from each AI response, group headings by message, and support
click-to-scroll navigation.

**Core architecture rule: ChatGPT and Gemini must be implemented completely
independently. Each platform owns its own files and logic, with no shared TOC
code and no cross-imports.**

---

## Files To Create Or Modify

### New Files

1. `src/content/toc-chatgpt.ts` - Complete standalone TOC module for ChatGPT.
2. `src/content/toc-gemini.ts` - Complete standalone TOC module for Gemini.

### Modified Files

3. `src/content/chatgpt.ts` - Call `initChatGptToc()` at the end of
   `startChatGptIntegration()`.
4. `src/content/index.ts` - Call `initGeminiToc()` for the Gemini platform path.
5. `src/content/styles.css` - Append global TOC panel styles using the
   `.sp-toc-*` prefix.
6. `src/shared/settings.ts` - Add the `tocEnabled: boolean` setting, defaulting
   to `true`.
7. `src/options/index.ts` - Load and save the `tocEnabled` setting.
8. `public/options/index.html` - Add an "Enable table of contents panel"
   checkbox.
9. `vite.config.ts` - Raise the build chunk-size warning limit to `1000` kB.

---

## Feature Specification

### DOM Structure

Both platforms should use the same DOM shape:

```text
.sp-toc-panel[data-show-pic-toc] (position: fixed, draggable)
├── .sp-toc-header (drag handle + buttons)
│   ├── .sp-toc-title ("Contents")
│   ├── .sp-toc-theme (theme mode button: A / L / D)
│   ├── .sp-toc-collapse (collapse/expand button: − / +)
│   └── .sp-toc-close (close button: ×)
└── .sp-toc-body (display: flex)
    ├── .sp-toc-nav (narrow left column, 36px wide)
    │   └── .sp-toc-nav-item[data-msg-index="N"] (round numeric button: 1, 2, 3...)
    └── .sp-toc-content (right content area, flex: 1)
        └── .sp-toc-message[data-msg-index="N"] (one group per message)
            ├── .sp-toc-msg-label ("Reply N")
            └── .sp-toc-items
                └── .sp-toc-item[data-level="1-6"] (heading item, indented by level)

.sp-toc-trigger[data-show-pic-toc] (floating reopen button shown after closing the panel, displays ☰)
```

### Core Behavior

1. **Heading extraction**
   - ChatGPT: query `[data-message-author-role="assistant"]` and extract nested
     `h1`-`h6` headings.
   - Gemini: use fallback selectors such as `model-response .markdown`,
     `.model-response-text`, `message-content`, and similar response containers.
   - Create TOC entries only for messages with headings.
   - Message numbering is sequential (`1`, `2`, `3`, ...), counting only
     responses that contain headings.

2. **Navigation strip**
   - A narrow 36px left column with 24x24px round numeric buttons.
   - Clicking a number scrolls the host page to the matching message and scrolls
     the TOC content area to the matching heading group.
   - `IntersectionObserver` highlights the currently visible message number with
     `.sp-toc-nav-active`.

3. **Dragging**
   - Implement with Pointer Events (`pointerdown`, `pointermove`, `pointerup`) on
     the panel header.
   - Persist position in `chrome.storage.local`.
   - ChatGPT key: `"sp-toc-position"`.
   - Gemini key: `"sp-toc-position-gemini"`.
   - Constrain the panel to the viewport.

4. **Collapse, close, and reopen**
   - Collapse hides `.sp-toc-body` with `max-height: 0` and `opacity: 0`, leaving
     only the header visible.
   - Close hides the whole panel and shows `.sp-toc-trigger`.
   - Clicking the trigger button reopens the panel.

5. **MutationObserver**
   - Observe `document.body` with `childList: true, subtree: true`.
   - Debounce updates by 300ms.
   - Ignore mutations inside TOC-owned DOM by checking `[data-show-pic-toc]`.

6. **Route and conversation switching**
   - Watch `popstate`.
   - Poll for URL changes every 1000ms.
   - On route changes, clear the TOC, disconnect the active
     `IntersectionObserver`, then rescan after a 600ms delay.

7. **Empty state**
   - Hide the panel when no messages have headings.
   - Automatically show the panel when headings exist.

8. **Settings integration**
   - Read `tocEnabled` from `chrome.storage.sync` during initialization.
   - Default is `true`.
   - If disabled, return immediately and do not create any DOM.

9. **Theme behavior**
   - Default to Auto mode, which detects the current ChatGPT/Gemini theme from
     host classes, `data-theme`, `color-scheme`, or body background luminance.
   - Provide a header button that cycles through Auto, Light, and Dark.
   - Persist manual choices per platform:
     - ChatGPT key: `"sp-toc-theme"`.
     - Gemini key: `"sp-toc-theme-gemini"`.
   - Apply the effective theme with `data-sp-toc-theme="light|dark"` so manual
     choices override system `prefers-color-scheme`.

### Key Constants

- Debounce: 300ms.
- `IntersectionObserver` threshold: `0.1`.
- URL check interval: 1000ms.
- Initial scan delay: 500-600ms.
- Default panel position: `top: 80px`, `right: 12px`.
- `z-index`: `2147483640`.

---

## Style Specification

Append TOC styles to the end of `src/content/styles.css` with the `.sp-toc-*`
prefix.

### Panel

- `position: fixed`.
- Width: approximately 228px.
- Maximum height: 70vh.
- Lightweight frosted-glass effect:
  `background: rgba(255,255,255,0.78); backdrop-filter: blur(12px)`.
- Rounded corners: 12px.
- Subtle shadow.
- Default opacity around 0.72, increasing to full opacity on hover, focus, or
  drag.
- `z-index: 2147483640`.

### Navigation Strip

- `.sp-toc-nav`: 36px wide, `flex-direction: column`, with a subtle right
  border.
- `.sp-toc-nav-item`: 24x24 round button, 11px font size, medium-light weight.
- `.sp-toc-nav-active`: `background: #2563eb; color: #fff`.

### Heading Indentation

- `data-level="1"`: `padding-left: 12px`, light-to-normal font weight.
- `data-level="2"`: `padding-left: 24px`, light-to-normal font weight.
- `data-level="3"`: `padding-left: 36px`.
- `data-level="4"` through `data-level="6"`: `padding-left: 48px` to `72px`,
  11px font size.

### Dark Mode

Support both automatic and explicit theme selection:

1. `@media (prefers-color-scheme: dark)` for OS-level fallback.
2. `html.dark .sp-toc-*` / `.dark .sp-toc-*` for host theme classes.
3. `.sp-toc-panel[data-sp-toc-theme="dark"]` and
   `.sp-toc-panel[data-sp-toc-theme="light"]` for the effective TOC theme.

Dark values:

- Background: `rgba(30,30,30,0.78)` by default and `0.92` on hover/focus.
- Text: `#e4e4e4`.
- Border: `rgba(255,255,255,0.08)`.
- Active color: `#3b82f6`.

---

## Integration Details

### ChatGPT (`src/content/chatgpt.ts`)

```typescript
import { initChatGptToc } from "./toc-chatgpt";

// At the end of startChatGptIntegration():
void initChatGptToc();
```

### Gemini (`src/content/index.ts`)

```typescript
import { initGeminiToc } from "./toc-gemini";

if (PLATFORM === "gemini") {
  void initGeminiToc();
}
```

### Settings (`src/shared/settings.ts`)

```typescript
export type ExtensionSettings = {
  plantumlServerBaseUrl: string;
  tocEnabled: boolean;
};

export const DEFAULT_SETTINGS: ExtensionSettings = {
  plantumlServerBaseUrl: "https://www.plantuml.com/plantuml",
  tocEnabled: true
};
```

---

## Additional Change: Remove Diagram Height Limits

In `src/content/styles.css`, remove `max-height: 80vh` from these selectors:

- `.sp-inline-diagram__viewport`
- `.sp-cgpt-card__viewport`

Keep `overflow: hidden`, which is required for zoom and drag behavior, but do not
limit the container height so diagrams can use their natural height.

---

## Constraints

- Use TypeScript strict mode.
- Do not use `any`.
- Use the `.sp-` prefix for all CSS class names.
- Mark every TOC-owned element with `data-show-pic-toc`.
- Keep ChatGPT and Gemini modules completely independent. Do not share code or
  import one TOC module from the other.
- `initChatGptToc()` and `initGeminiToc()` must both be async functions.
- Ensure `npx tsc --noEmit` and `npx eslint .` pass.
