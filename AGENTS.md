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

## Release & Changelog Rules

The `Release` workflow (`.github/workflows/release.yml`) extracts the section
matching the pushed tag from `CHANGELOG.md` and uses it as the GitHub Release
body. GitHub's auto-generated "Full Changelog" link is appended after.

When preparing a new version, follow these rules:

1. **Single source of truth.** Detailed release notes live in `CHANGELOG.md`,
   not in the workflow YAML and not only in tag annotations. Tag annotations
   stay short (`vX.Y.Z — short summary. See CHANGELOG.md for details.`).
2. **Section format.** Add a new top-level section above older versions:

   ```md
   ## [vX.Y.Z] — YYYY-MM-DD

   <one-paragraph summary of the release>

   ### Highlights
   - …

   ### Tooling
   - …

   ### Install
   1. Download `show-pic-vX.Y.Z.zip` from the assets below and extract it.
   2. Open `chrome://extensions/` and enable **Developer mode**.
   3. Click **Load unpacked** and select the extracted folder.

   ### Known limitations
   - …
   ```

   The header MUST contain `[vX.Y.Z]` so the workflow's `awk` extractor
   matches it. Optional `### Added / Changed / Fixed / Removed` subsections
   are encouraged for non-initial releases.
3. **Tag = CHANGELOG section.** Never push a tag whose `CHANGELOG.md` section
   is missing or empty. The workflow falls back to a placeholder, which is
   considered a release-blocking bug.
4. **Bump `package.json` version** in the same commit that introduces the
   new `CHANGELOG.md` section so the manifest, the changelog, and the tag
   all agree.
5. **Release flow:**

   ```sh
   # 1. Edit CHANGELOG.md and package.json on main
   git commit -am "release: vX.Y.Z"
   git push origin main

   # 2. Tag and push
   git tag -a vX.Y.Z -m "vX.Y.Z — <short summary>. See CHANGELOG.md for details."
   git push origin vX.Y.Z
   ```

6. **No retroactive edits to shipped sections.** Once a tag is pushed, treat
   its `CHANGELOG.md` section as immutable. Corrections go into the next
   version's `### Fixed` (or a new patch release).

## Review Checklist

- The extension still builds as Manifest V3.
- Mermaid and PlantUML examples render on both ChatGPT and Gemini.
- Streaming or regenerated chatbot messages do not create duplicate diagram cards.
- Dark mode and long diagrams remain usable.
- PlantUML privacy implications remain visible in docs and settings.
