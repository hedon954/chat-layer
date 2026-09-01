# Changelog

All notable changes to this project are documented in this file. The format
is loosely based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

The release workflow extracts the section matching the pushed tag and uses it
as the GitHub Release body, so each version section should be self-contained.

## [v0.5.4] — 2026-09-01

This patch release keeps default PlantUML cards compact on ChatGPT, and makes
Gemini diagrams replace the native code block as one light surface that can
toggle back to source without leaving the rendered image behind.

### Highlights
- ChatGPT PlantUML now sizes the diagram around its content instead of leaving
  a tall empty canvas.
- Gemini PlantUML fills the code-block width and paints the host chrome as a
  single light surface, so the black header no longer frames a white diagram.
- The Gemini header **PlantUML** control stays aligned with Download and Copy,
  and 「代码段」 stays inset from the left edge.
- Clicking **Source** hides the rendered diagram completely; clicking
  **PlantUML** again restores the in-place diagram.

### Changed
- ChatGPT uses a compact default diagram height.
- Gemini uses width-fitting diagram sizing so sequence diagrams are not
  stamped into a small centered box.

### Fixed
- Gemini Source view left the PlantUML surface visible because `display: flex`
  overrode the `hidden` attribute.
- Gemini code-block chrome stayed black around the white diagram after render.
- Gemini header title could be clipped when the diagram host padding was
  removed.

### Tooling
- Synchronized `package.json`, `package-lock.json`, and the extension manifest
  on version `0.5.4`.

### Install
1. Download `chatlayer-v0.5.4.zip` from the assets below and extract it.
2. Open `chrome://extensions/` and enable **Developer mode**.
3. Click **Load unpacked** and select the extracted folder.

### Known limitations
- Heading highlight still depends on rendered DOM elements. ChatGPT or Gemini
  virtualized content must re-enter the DOM before its exact heading can become
  active in the TOC.

## [v0.5.3] — 2026-09-01

This patch release makes ChatGPT PlantUML rendering switch source and diagram
in the same code block, matching the existing Gemini behavior.

### Highlights
- ChatGPT no longer inserts a separate PlantUML card below the original source.
- Clicking **PlantUML** hides the source and shows the diagram in that same
  code block.
- Clicking **Source** on the diagram toolbar restores the original source;
  clicking **PlantUML** again returns to the already-rendered diagram.

### Fixed
- ChatGPT PlantUML source and diagram were shown as two stacked views instead
  of one in-place toggle.

### Tooling
- Synchronized `package.json`, `package-lock.json`, and the extension manifest
  on version `0.5.3`.

### Install
1. Download `chatlayer-v0.5.3.zip` from the assets below and extract it.
2. Open `chrome://extensions/` and enable **Developer mode**.
3. Click **Load unpacked** and select the extracted folder.

### Known limitations
- Heading highlight still depends on rendered DOM elements. ChatGPT or Gemini
  virtualized content must re-enter the DOM before its exact heading can become
  active in the TOC.

## [v0.5.2] — 2026-08-31

This patch release stops the floating table of contents from following the
cursor after a drag, and keeps a small gap when the panel docks to the right.

### Highlights
- Dragging the Contents panel now releases on mouse-up instead of staying
  attached to the pointer.
- After you move the panel in the current session, it no longer tracks the
  window's right edge when the browser is resized.
- Default right-dock uses the same 8px inset as dragging the panel to the
  right edge.

### Fixed
- TOC drag left a window `pointermove` listener attached after pointer-up was
  swallowed by ChatGPT or Gemini, so the panel kept following the cursor.
- Default dock sat flush against the window instead of leaving the same gap
  as a manual drag to the right.

### Tooling
- Synchronized `package.json`, `package-lock.json`, and the extension manifest
  on version `0.5.2`.

### Install
1. Download `chatlayer-v0.5.2.zip` from the assets below and extract it.
2. Open `chrome://extensions/` and enable **Developer mode**.
3. Click **Load unpacked** and select the extracted folder.

### Known limitations
- Heading highlight still depends on rendered DOM elements. ChatGPT or Gemini
  virtualized content must re-enter the DOM before its exact heading can become
  active in the TOC.

## [v0.5.1] — 2026-08-31

The floating table of contents now docks to the right edge of the browser on
every page load, with a content-aware height that stays readable as a
conversation grows.

### Highlights
- Default layout sits flush against the right edge and is vertically centered.
- Default height is 50% of the viewport and grows with TOC content up to 80%
  (10% gap above and below).
- After the 80% cap, the existing inner scroll still applies.
- Dragging or resizing leaves default layout for the rest of the session; a
  reload restores the default.

### Changed
- ChatGPT and Gemini TOC panels no longer restore a stored position or size on
  page enter or refresh.

### Tooling
- Synchronized `package.json`, `package-lock.json`, and the extension manifest
  on version `0.5.1`.

### Install
1. Download `chatlayer-v0.5.1.zip` from the assets below and extract it.
2. Open `chrome://extensions/` and enable **Developer mode**.
3. Click **Load unpacked** and select the extracted folder.

### Known limitations
- Heading highlight still depends on rendered DOM elements. ChatGPT or Gemini
  virtualized content must re-enter the DOM before its exact heading can become
  active in the TOC.

## [v0.5.0] — 2026-08-18

Reply labels in the floating table of contents now include a short preview of
the matching user message, so long conversations are easier to scan and jump
between.

### Highlights
- Each `Reply N` label appends the start of the preceding user prompt.
- Preview text wraps to at most two lines, with a tooltip for a longer snippet.
- ChatGPT and Gemini both cache the preview after first discovery so virtualized
  user messages do not blank the label later.

### Added
- User-message previews on ChatGPT and Gemini TOC reply labels, including hover
  titles on both the label and the numbered nav pill.

### Tooling
- Synchronized `package.json`, `package-lock.json`, and the extension manifest
  on version `0.5.0`.

### Install
1. Download `chatlayer-v0.5.0.zip` from the assets below and extract it.
2. Open `chrome://extensions/` and enable **Developer mode**.
3. Click **Load unpacked** and select the extracted folder.

### Known limitations
- A preview appears only after the matching user message has been seen in the
  DOM. Turns that were never rendered may keep a plain `Reply N` label until a
  later scan.
- Heading highlight still depends on rendered DOM elements. ChatGPT or Gemini
  virtualized content must re-enter the DOM before its exact heading can become
  active in the TOC.

## [v0.4.1] — 2026-05-14

This patch release restores reply-level navigation alignment while preserving
the centered heading jump behavior introduced in v0.4.0.

### Fixed

- Restored reply jumps to align the selected reply at the top of the viewport
  while keeping individual heading jumps centered for easier reading.
- Improved scroll recovery for virtualized ChatGPT and Gemini content so found
  replies and headings use the intended alignment after they re-enter the DOM.
- Tightened TOC active-heading detection around the middle reading band to keep
  the highlighted heading more stable during scroll.

### Tooling

- Synchronized `package.json`, `package-lock.json`, and the extension manifest
  on version `0.4.1`.

### Install

1. Download `chatlayer-v0.4.1.zip` from the assets below and extract it.
2. Open `chrome://extensions/` and enable **Developer mode**.
3. Click **Load unpacked** and select the extracted folder.

### Known limitations

- Heading highlight still depends on rendered DOM elements. ChatGPT or Gemini
  virtualized content must re-enter the DOM before its exact heading can become
  active in the TOC.

## [v0.4.0] — 2026-05-14

Major improvements to the floating table-of-contents panel: manual refresh,
scroll-based heading highlight, cache-based architecture for long virtualized
conversations, and several heading-detection fixes for ChatGPT.

### Added

- **Manual refresh button**: ↻ button in the TOC header re-scans the page and
  rebuilds the TOC on demand with a 400 ms spin animation for feedback.
- **Scroll-based heading highlight**: as the user scrolls, the TOC entry
  corresponding to the heading in the reading zone (top 40 % of viewport) is
  highlighted with a left-border accent. The active Reply label and nav pill
  stay in sync. Supports light/dark modes and explicit theme overrides.
- **Cache-based TOC architecture**: once a heading is discovered it stays in
  the TOC even when ChatGPT/Gemini virtualizes the source element.
  `mergeFreshIntoCache` updates element refs on each scan; `buildOrderedEntries`
  sorts by DOM position; a fingerprint check (level + text) prevents unnecessary
  UI rebuilds. The heading observer is reconnected with fresh element refs even
  when the fingerprint is unchanged.
- **Click-to-scroll fallback for virtualized headings**: if the target heading
  is not rendered, `scrollToHeading` jumps to the message container, detects
  the actual scrollable ancestor, estimates scroll direction via
  `elementFromPoint` + `compareDocumentPosition`, and progressively scrolls
  (up to 30 × 0.7 viewport-heights) until the heading appears or the boundary
  is reached. Both up and down directions are tried.
- All AI replies now appear in the TOC as "Reply N" even when they contain no
  headings.

### Changed

- **Heading extraction scope (ChatGPT)**: broadened search from the narrow
  `[data-message-author-role]` element to the full turn container (`article` /
  `[data-testid^="conversation-turn-"]`), catching headings placed outside the
  role div.

### Fixed

- **ChatGPT attribution filter**: headings like "ChatGPT 说：" / "ChatGPT says:"
  are filtered from the TOC. Real headings containing "ChatGPT" still appear.
- **Fingerprint guard**: `refreshToc` computes a text fingerprint and skips the
  rebuild when headings are unchanged, preventing flicker during scroll-triggered
  DOM mutations.
- **Stale heading refs**: `reconnectHeadingObserver` clears orphaned active
  classes and re-maps fresh element refs after the platform re-renders
  virtualized content.
- **Scroll direction**: `estimateScrollDirection` probes the visible area to
  pick the correct initial direction, eliminating the "scroll down then back up"
  behavior when navigating to earlier messages.
- **Visibility check**: `isElementRendered` checks both `isConnected` and
  non-zero bounding rect, preventing silent no-op `scrollIntoView` calls on
  zero-size virtualized elements.

### Install

1. Download `chatlayer-v0.4.0.zip` from the assets below and extract it.
2. Open `chrome://extensions/` and enable **Developer mode**.
3. Click **Load unpacked** and select the extracted folder.

### Known limitations

- Heading highlight relies on `IntersectionObserver`; headings whose DOM
  elements are currently virtualized cannot be highlighted until the platform
  re-renders them (a manual scroll or refresh triggers this).
- The progressive scroll-search has a finite budget (30 steps ≈ 4.5 s); in
  extremely long conversations the target heading may not be reached.

## [v0.3.3] — 2026-05-13

This patch release makes the floating table-of-contents panel more resilient
and adjustable when users zoom or resize ChatGPT and Gemini pages.

### Added

- Added bottom-corner resize handles to the ChatGPT and Gemini TOC panel.
- Stored per-platform TOC panel dimensions in `chrome.storage.local` after
  resizing.
- Added focused unit tests for TOC position and size constraints.

### Fixed

- Kept the TOC panel inside the viewport when Chrome zoom or window size
  changes would otherwise move it off-screen.
- Restored TOC panel position using non-zero fallback dimensions so hidden
  panels do not calculate invalid bounds.
- Constrained custom TOC sizes to the current viewport while preserving internal
  scrolling for long reply outlines.

### Install

1. Download `chatlayer-v0.3.3.zip` from the assets below and extract it.
2. Open `chrome://extensions/` and enable **Developer mode**.
3. Click **Load unpacked** and select the extracted folder.

### Known limitations

- TOC resizing is available from the bottom corners of the panel; collapsed
  panels must be expanded before resizing the content area.
- ChatGPT and Gemini may change their DOM structures, so TOC selectors may need
  future platform-specific maintenance.

## [v0.3.2] — 2026-05-13

This patch release tightens table-of-contents behavior for ChatGPT and Gemini
so reply navigation consistently tracks AI responses rather than incidental
headings or platform labels.

### Fixed

- ChatGPT reply counting now only includes visible assistant messages and
  deduplicates nested conversation-turn nodes.
- ChatGPT reply navigation now scrolls to the start of the AI response instead
  of the first heading inside that response.
- Gemini now shows every AI reply in the TOC, including replies without markdown
  headings, matching the ChatGPT behavior.
- Gemini reply navigation now scrolls to the start of the AI response from both
  the message number and the `Reply n` label.
- Gemini attribution headings such as `Gemini 说`, `Gemini says`, and
  `Gemini said` are filtered out of TOC entries.

### Install

1. Download `chatlayer-v0.3.2.zip` from the assets below and extract it.
2. Open `chrome://extensions/` and enable **Developer mode**.
3. Click **Load unpacked** and select the extracted folder.

### Known limitations

- ChatGPT and Gemini may change their DOM structures, so TOC selectors may need
  future platform-specific maintenance.

## [v0.3.1] — 2026-05-13

This patch release adds the ChatLayer extension icon set and wires it into the
Manifest V3 metadata used by Chrome's extension surfaces.

### Added

- Added ChatLayer icon assets in Chrome extension sizes: 16, 32, 48, and 128
  pixels, plus a 1024-pixel source-sized export for future packaging needs.
- Configured the manifest `icons` and browser action `default_icon` entries to
  use the new ChatLayer artwork.
- Added the source icon image under `assets/` so the extension icons can be
  regenerated consistently.

### Install

1. Download `chatlayer-v0.3.1.zip` from the assets below and extract it.
2. Open `chrome://extensions/` and enable **Developer mode**.
3. Click **Load unpacked** and select the extracted folder.

### Known limitations

- Chrome may cache extension icons after reloads; remove and reload the unpacked
  extension if the old icon still appears.

## [v0.3.0] — 2026-05-13

The extension has been renamed from Show Pic to ChatLayer to better reflect its
broader direction: a power-user enhancement layer for ChatGPT, Gemini, and other
AI chatbot interfaces.

### Changed

- Renamed the extension, documentation, options page, viewer page, and release
  artifact naming from Show Pic to ChatLayer.
- Updated the package name to `chatlayer` and bumped the extension manifest to
  version `0.3.0`.
- Updated the release workflow to publish `chatlayer-vX.Y.Z.zip` artifacts.

### Install

1. Download `chatlayer-v0.3.0.zip` from the assets below and extract it.
2. Open `chrome://extensions/` and enable **Developer mode**.
3. Click **Load unpacked** and select the extracted folder.

### Known limitations

- Some internal DOM attributes and extension message identifiers still use the
  historical `show-pic` prefix for compatibility with existing injected nodes
  and content-script cleanup logic.

## [v0.2.0] — 2026-05-13

ChatLayer now adds a lightweight floating table of contents for long ChatGPT and
Gemini responses, making heading-heavy conversations easier to navigate without
changing the original chatbot layout.

### Added

- **Floating conversation table of contents.** ChatGPT and Gemini now get
  independent TOC content modules that extract `h1`-`h6` headings from assistant
  responses and group them by reply.
- **Message navigation strip.** The panel includes round numeric buttons for
  replies with headings, click-to-scroll behavior, and active-message tracking
  through `IntersectionObserver`.
- **Draggable persistent panel.** Panel position is constrained to the viewport
  and stored per platform in `chrome.storage.local`.
- **Panel controls.** Users can collapse, close, and reopen the TOC panel from a
  floating trigger.
- **Theme controls.** The TOC follows the host ChatGPT/Gemini theme by default
  and includes an Auto/Light/Dark toggle with per-platform persistence.
- **Options toggle.** The options page now exposes an "Enable table of contents
  panel" checkbox backed by the `tocEnabled` setting.

### Changed

- Removed the previous `max-height: 80vh` cap from inline diagram viewports so
  tall diagrams can use their natural height.
- Raised Vite's chunk-size warning threshold to 1000 kB to avoid noisy warnings
  from the bundled Mermaid dependency.
- Translated the TOC implementation plan to English in `docs/plans/toc.md`.

### Install

1. Download `show-pic-v0.2.0.zip` from the assets below and extract it.
2. Open `chrome://extensions/` and enable **Developer mode**.
3. Click **Load unpacked** and select the extracted folder.

### Known limitations

- ChatGPT and Gemini DOM structures may evolve; the TOC intentionally uses
  platform-specific content modules so selectors can be adjusted independently.
- The default PlantUML server still sends diagram source over the network; for
  private content, configure a self-hosted server in the options page.

## [v0.1.0] — 2026-05-13

Initial public release. Show Pic is a Chrome (Manifest V3) extension that
turns Mermaid and PlantUML markdown code blocks inside ChatGPT and Gemini
responses into rendered, zoomable diagrams.

### Highlights

- **Click-to-render UX.** Detected diagrams expose a small button next to
  the chatbot's native code-block toolbar instead of auto-rendering, so
  streamed conversations stay responsive.
- **Independent ChatGPT and Gemini integrations.** The two products diverge
  enough to deserve separate code paths:
  - **ChatGPT** (`chatgpt.com`, `chat.openai.com`) — PlantUML only; Mermaid is
    rendered natively. Detection scans `<pre>` elements, reads the language
    label from the sticky header, walks the tokenized `<span>` soup, and
    applies keyword-based line recovery for sources whose newlines were
    swallowed by the renderer.
  - **Gemini** (`gemini.google.com`) — both Mermaid and PlantUML, using a
    shared scanner over `<code-block>` custom elements that already
    preserves real `\n` text nodes.
- **Sandboxed Mermaid renderer.** Mermaid runs in an extension-owned iframe
  sandbox to satisfy host CSPs, and is bundled into the extension so no CDN
  is contacted at runtime.
- **Configurable PlantUML backend.** The options page accepts a self-hosted
  PlantUML server URL; the public PlantUML service is the default.
- **Inline diagram surface.** Each rendered diagram comes with zoom in/out,
  1:1 reset, fit-to-width, source toggle, SVG download, and pan-by-drag —
  all in a card that adapts to the chat column width.
- **Hardened SVG handling.** Server output is sanitized
  (`<script>` / `<foreignObject>` / `<iframe>` / `on*` handlers / external
  `@import` / external `url()` removed); the root `<svg>` is stripped of
  intrinsic `width`/`height` and given a synthesized `viewBox` so the
  diagram scales to the card.
- **Defensive source extraction.** A clean-text walker skips any of the
  extension's own injected nodes (`sp-inline-diagram`, `sp-cgpt-card`,
  `sp-cgpt-btn`, `sp-code-render-button`, `sp-diagram-card`) so subsequent
  re-scans never feed our control labels back into the diagram source —
  this fixes Mermaid lexical errors and PlantUML render corruption that
  appeared after toggling Source/preview.

### Tooling

- TypeScript + Vite build pipeline with strict typecheck.
- ESLint + `typescript-eslint`.
- Vitest unit tests covering PlantUML normalization/encoding and the
  diagram detector.
- GitHub Actions CI on every push and PR.
- GitHub Actions release workflow that packages `dist/` into a zip and
  publishes it (with SHA-256 checksum) as a GitHub Release asset.

### Install

1. Download `show-pic-v0.1.0.zip` from the assets below and extract it.
2. Open `chrome://extensions/` and enable **Developer mode** (top-right).
3. Click **Load unpacked** and select the extracted folder.

Verify with:

```sh
shasum -a 256 -c show-pic-v0.1.0.zip.sha256
```

### Known limitations

- ChatGPT's DOM may evolve. If detection regresses, see
  [`docs/bugs/implementation-notes.md`](docs/bugs/implementation-notes.md)
  for the assumptions baked into `src/content/chatgpt.ts`.
- The default PlantUML server sends diagram source over the network; for
  private content, configure a self-hosted server in the options page.
