# Changelog

All notable changes to this project are documented in this file. The format
is loosely based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

The release workflow extracts the section matching the pushed tag and uses it
as the GitHub Release body, so each version section should be self-contained.

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
