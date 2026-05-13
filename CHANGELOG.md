# Changelog

All notable changes to this project are documented in this file. The format
is loosely based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

The release workflow extracts the section matching the pushed tag and uses it
as the GitHub Release body, so each version section should be self-contained.

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
