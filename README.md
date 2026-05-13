# ChatLayer

ChatLayer is a Chrome extension that adds a power-user enhancement layer to AI chat interfaces.

The first supported targets are ChatGPT and Gemini. The extension currently adds rendered Mermaid and PlantUML diagram previews, long-response outlines, and lightweight workflow controls without replacing the original chatbot UI.

## Supported Sites

- `https://chatgpt.com/*`
- `https://chat.openai.com/*`
- `https://gemini.google.com/*`

## Supported Diagram Blocks

- Mermaid blocks tagged as `mermaid`
- PlantUML blocks tagged as `plantuml` or `puml`
- PlantUML blocks that start with `@startuml`

## Development

```sh
make install
make dev
```

For a production build:

```sh
make ci
```

## Install From a Release

Pre-built archives are attached to every [GitHub Release](../../releases/latest):

1. Download `chatlayer-vX.Y.Z.zip` from the latest release and extract it.
2. Open `chrome://extensions/`.
3. Enable **Developer mode** (top-right).
4. Click **Load unpacked** and select the extracted folder.

Verify the download with the bundled checksum:

```sh
shasum -a 256 -c chatlayer-vX.Y.Z.zip.sha256
```

## Loading in Chrome (from source)

1. Build the extension with `make build`.
2. Open `chrome://extensions`.
3. Enable Developer Mode.
4. Select Load unpacked.
5. Choose the generated `dist/` directory.

## Cutting a Release

```sh
git tag vX.Y.Z
git push origin vX.Y.Z
```

The `Release` workflow runs CI, packages `dist/` into `chatlayer-vX.Y.Z.zip`,
generates release notes, and uploads the archive plus its SHA-256 checksum
to a new GitHub Release. You can also trigger the workflow manually from the
Actions tab and pass an arbitrary version label.

## Privacy Note

Mermaid diagrams are rendered locally by JavaScript bundled into the extension. The extension does not load Mermaid from a CDN or other remote script host.

PlantUML diagrams are rendered through a PlantUML server URL. The default server is the public PlantUML service, which means PlantUML diagram source is sent to that server. Use the extension options page to switch to a local or self-hosted PlantUML server for private diagrams.

## Diagram Viewer

Rendered diagrams include a larger viewer with zoom, reset, drag-to-pan, source copy, and server-open controls. These controls are provided by the extension UI, so they work consistently even when the original diagram format does not provide native interactivity.

## Project Commands

```sh
make install     # install dependencies
make dev         # run Vite development mode
make build       # build the extension into dist/
make typecheck   # run TypeScript checks
make lint        # run ESLint
make test        # run unit tests
make ci          # run all validation used by CI
make clean       # remove generated output
```
