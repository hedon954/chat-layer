# Project Guidance

This project is an English-only Chrome extension codebase. Keep all source code, comments, documentation, commit messages, UI copy, and test names in English.

## Product Goal

Render Mermaid and PlantUML diagrams from chatbot markdown code blocks on ChatGPT and Gemini without disrupting the original conversation UI.

## Engineering Rules

- Use TypeScript for extension logic.
- Prefer small, typed modules with explicit responsibilities.
- Keep Manifest V3 compatibility in mind for every browser API and build choice.
- Do not load remote executable scripts. Package JavaScript dependencies into the extension build.
- Keep content scripts resilient. Prefer generic markdown/code-block detection over brittle product-specific CSS class names.
- Mark processed DOM nodes with extension-owned data attributes to avoid duplicate rendering.
- Fail inline and recoverably. Rendering errors must not break the host chatbot page.

## Rendering Rules

- Mermaid rendering must stay isolated from the host page and should use a sandboxed extension page.
- Mermaid must use a restrictive security configuration unless there is a reviewed product reason to change it.
- PlantUML rendering may use a remote server, but the UI and documentation must clearly state that the diagram source is sent to the configured server.
- PlantUML server URLs must be configurable so users can choose a local or self-hosted server.

## Quality Bar

- Run `make ci` before considering implementation complete when dependencies are available.
- Add focused unit tests for pure detection, encoding, and state-management logic.
- Keep UI behavior manually testable in Chrome with the unpacked `dist/` extension.
- Do not commit generated extension bundles or local secrets.

## Review Checklist

- The extension still builds as Manifest V3.
- Mermaid and PlantUML examples render on both ChatGPT and Gemini.
- Streaming or regenerated chatbot messages do not create duplicate diagram cards.
- Dark mode and long diagrams remain usable.
- PlantUML privacy implications remain visible in docs and settings.
