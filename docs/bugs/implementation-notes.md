# Implementation Notes & Hard-Won Lessons

This document captures the non-obvious problems we hit while building the
chatbot diagram renderer (Mermaid + PlantUML for ChatGPT and Gemini), and the
fixes we landed. Future contributors should read this before touching the
content script, the platform-specific integrations, or the source extraction
pipeline.

---

## 1. ChatGPT and Gemini have fundamentally different DOM models

We initially tried to write one shared scanner that worked on both sites.
That direction kept producing fragile compatibility code. After several
rewrites we accepted that the two products diverge enough to deserve
independent integrations.

**Gemini**

- Renders code blocks as a custom `<code-block>` element wrapping
  `<pre><code class="language-…">…</code></pre>`.
- Preserves real `\n` text nodes inside `<code>`, so `textContent` already
  contains correct line breaks.
- Mermaid is *not* rendered natively, so we render both Mermaid and PlantUML.

**ChatGPT (2026 layout)**

- The whole code block (header + body) is wrapped in `<pre>`.
- There is no `<code class="language-plantuml">`. The language label lives in
  a sibling `<div class="…justify-self-start…">plantuml</div>` inside a
  `sticky` header.
- Source text inside `<pre>` is heavily tokenized into `<span>` nodes with
  no `\n` separators. `textContent` returns one big flattened string.
- Mermaid is rendered natively by ChatGPT; we only handle PlantUML.

**Resolution.** `src/content/chatgpt.ts` is a self-contained module that
owns scanning, button placement, source extraction, and the rendering
surface for ChatGPT. The shared `index.ts` short-circuits on
`PLATFORM === "chatgpt"` and never runs its generic logic there.
`shouldRenderDiagram()` returns `false` for ChatGPT so even if the shared
scanner were reached it would do nothing.

---

## 2. ChatGPT swallows the newlines we need

The biggest single time-sink. ChatGPT's tokenizer outputs:

```html
<span>@startuml</span><span>actor</span><span>用户</span><span>as</span><span>User</span><span>participant</span>…
```

with no whitespace text nodes in between. As a result:

- `code.textContent` returns
  `"@startumlactor 用户 as Userparticipant \"前端页面\"…"`
- `code.innerText` returns the same flattened string because there are no
  block-level boundaries either.

Sending that to the PlantUML server returns the welcome page (because
`@startuml` is glued to `actor`, `actor` to `用户`, etc.).

**Resolution.** A two-stage line recovery in `src/render/plantuml.ts`:

1. **DOM walk** (`walkBlockAware` / `serializeBlockAware`) which inserts
   `\n` whenever it crosses a known block-level tag or a class that looks
   line-like (`line`, `row`, `hljs-ln-line`).
2. **PlantUML keyword heuristic** (`recoverLines`) applied when the source
   still has no newlines after the DOM walk. It uses several targeted
   regexes:
   - `RECOVER_AFTER_START` — break after `@start*` when followed by a
     known PlantUML keyword.
   - `RECOVER_AFTER_AS` — break after `as|alt|else <name>` when followed
     by a known keyword.
   - `RECOVER_AFTER_AS_BEFORE_ARROW` — break after `as|alt|else <name>`
     when followed by `<Identifier> ARROW` (handles the messages section).
   - `RECOVER_CJK_TO_ASCII` — break at any Chinese-to-ASCII boundary
     (`数据库` → `Frontend`, `查询` → `@end`).
   - `RECOVER_BEFORE_END` — ensure `@enduml` lands on its own line.

A test in `tests/plantuml.test.ts` exercises the worst real-world payload
we observed.

### 2.1 Subtle regex bug: case-insensitive `[A-Z]`

`RECOVER_AFTER_AS_BEFORE_ARROW` initially used the `i` flag, which silently
turned `[A-Z]` into `[A-Za-z]`. With backtracking, "as DBUser ->" matched as
"as DBUse" + "r ->", producing broken output `as DBUse\nr -> Frontend`.
Fix: drop the `i` flag for that regex and require the next identifier to
start with `[A-Z][a-z]` (PascalCase) so `DBUser` correctly splits into
`DB` + `User` and never `D` + `BUser` or `DBUse` + `r`.

---

## 3. Reading our own UI back as source

Once we render a diagram into the page, our control bar (`-`, `100%`,
`1:1`, `+`, `Source`, `Download`) becomes a sibling of `<pre>` inside
Gemini's `<code-block>` container. Any subsequent `MutationObserver` tick
(streaming chunk, source/preview toggle, hover handlers) re-runs the
scanner on that container, and `textContent` happily returns the source
**plus** the button labels.

Symptoms:

- Mermaid: `Lexical error on line 16. Unrecognized text. ...->|Query/Mutate| DB−100%1:1+SourceDownload^`.
- PlantUML: a perfectly valid render replaced by an empty/wrong diagram
  the moment you click "Source" then back.

**Resolution.** A central `INJECTED_CLASS_NAMES` list and a
`readCleanTextContent` helper that walks the DOM but skips any subtree
rooted at one of our injected nodes:

- `sp-inline-diagram`, `sp-diagram-card`, `sp-code-render-button`
- `sp-cgpt-card`, `sp-cgpt-btn`

Every entry point that previously called `block.textContent` for detection
or render-key computation now goes through `readCleanTextContent`, and
`serializeBlockAware` short-circuits on `isInjectedNode`. The render key is
therefore stable across re-scans, and we no longer feed our own UI back
into the diagram source.

---

## 4. Buttons rendered with chatbot CSS look broken

ChatGPT's stylesheet aggressively styles bare `<button>` elements (dark
background, no border). Our render buttons inherited that and appeared as
unreadable black blobs.

**Resolution.** Every injected button explicitly resets `appearance`,
`box-sizing`, font, border, background, and color in `src/content/styles.css`.
We use a fixed light palette so the buttons read the same in dark and
light page themes. The cards (`.sp-cgpt-card`, `.sp-inline-diagram`) are
also forced to a neutral light background; we tried adapting fills/strokes
of PlantUML SVGs for dark mode and it always looked worse than just
sandboxing the diagram in a light card.

---

## 5. PlantUML SVG ignores CSS width

PlantUML SVGs ship with both an explicit `width=` attribute and an inline
`style="width:NNNpx;height:NNNpx"`. CSS rules without `!important` lost
the cascade and the diagram rendered at its intrinsic size while the
viewport stayed wide and empty.

**Resolution.** Two layers of defence:

1. `sanitizeSvg` (in `src/render/svg.ts`) strips `width`, `height`, and
   width/height/max-width/max-height declarations from the inline `style`
   on the root `<svg>`. It also synthesises a `viewBox` from the original
   width/height when one is missing.
2. The card's CSS uses
   `width: 100% !important; max-width: 100% !important; height: auto !important;`
   on `svg` so anything that survives sanitization is overridden.

---

## 6. Where to insert the rendered card matters

For ChatGPT we initially inserted the card as a sibling of `<pre>` inside
the wrapper. ChatGPT's wrapper has horizontal scrolling, so the card was
constrained to the source's intrinsic width and looked half-empty.

**Resolution.** ChatGPT's `<pre>` *is* the outermost code-block element,
so the card is inserted **after `<pre>`**, where it inherits the message
column width and renders edge-to-edge.

---

## 7. PlantUML source must round-trip cleanly

`normalizePlantUmlSource` is now responsible for the entire normalization
pipeline. It must always:

- Trim and replace non-breaking spaces.
- Locate `@start*` and `@end*` and discard anything outside.
- Wrap with `@startuml` / `@enduml` if missing.
- Run `recoverLines` only when the body has no `\n`.
- Collapse trailing whitespace and double newlines.

Tests in `tests/plantuml.test.ts` cover bare bodies, trailing/leading
chrome (`plantumlCopyDownload@startuml…`), missing `@enduml`, the
flattened-Chinese-mixed-with-English real-world example, and false-positive
guards (e.g. `actor Frontend` must not be split into `actor Front\nend`).

---

## 8. Defensive sanitization remains mandatory

Even though the SVG comes from a server you control, we always:

- Drop `<script>`, `<foreignObject>`, `<iframe>`, `<object>`, `<embed>`.
- Strip `onXxx` attributes and any `javascript:` URLs.
- Remove `@import` and absolute `url(https://…)` references inside
  `<style>` tags so the SVG cannot pull external resources.

This keeps the renderer safe against a compromised or malicious PlantUML
server and is required by Manifest V3's CSP.

---

## TL;DR for future contributors

1. Do not collapse the ChatGPT and Gemini integrations back together.
2. Never read `block.textContent` directly when the block might already
   contain our injected UI — use `readCleanTextContent`.
3. When the source comes back without newlines, suspect ChatGPT's
   tokenized `<span>` soup before suspecting our extractor.
4. Always run the full CI (`typecheck && lint && test && build`) before
   shipping; the regex changes in `plantuml.ts` are easy to break.
5. Keep `INJECTED_CLASS_NAMES` and `cleanupLegacyAutoRenderArtifacts`
   in sync whenever you introduce a new injected DOM class.
