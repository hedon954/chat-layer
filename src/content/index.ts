import "./styles.css";

import { startChatGptIntegration } from "./chatgpt";
import { detectDiagram, extractLanguageHints, type DetectedDiagram } from "./detector";
import { renderMermaidDiagram } from "./mermaid-client";
import { PLATFORM, shouldRenderDiagram } from "./platform";
import type { FetchPlantUmlSvgMessage, FetchPlantUmlSvgResponse } from "../shared/plantuml-render";
import { createPlantUmlSvgUrl } from "../render/plantuml";
import { sanitizeSvg } from "../render/svg";
import { loadSettings } from "../shared/settings";

const CODE_BLOCK_SELECTOR = [
  "pre code",
  "pre",
  "code",
  "code-block",
  "[data-test-id='code-content']",
  "[data-testid='code-content']",
  "[data-test-id*='code']",
  "[data-testid*='code']",
  "[class*='Code']",
  "[class*='code']",
  "[class*='code-block']",
  "[class*='codeBlock']",
  "[class*='formatted']",
  "[class*='highlight']"
].join(",");
const BUTTON_KEY_ATTRIBUTE = "data-show-pic-button-key";
const SCAN_DEBOUNCE_MS = 250;
const CONTENT_SCRIPT_VERSION = "0.1.0-click-to-render";

const pendingScanRoots = new Set<ParentNode>();
const observedRoots = new WeakSet<Node>();
const renderSurfaces = new WeakMap<HTMLElement, InlineDiagramSurface>();
let scanTimer: number | undefined;

type InlineDiagramSurface = {
  root: HTMLElement;
  sourceContent: HTMLElement;
  canvas: HTMLElement;
  zoomLabel: HTMLElement;
  setLoading: () => void;
  setSvg: (svg: string) => void;
  setError: (message: string) => void;
};

void start();

async function start(): Promise<void> {
  await waitForDocumentBody();
  document.documentElement.dataset.showPicVersion = CONTENT_SCRIPT_VERSION;
  document.documentElement.dataset.showPicPlatform = PLATFORM;
  console.info(
    `[Show Pic] ${CONTENT_SCRIPT_VERSION} loaded on ${PLATFORM}. Diagrams render only after clicking a Show Pic button.`
  );
  cleanupLegacyAutoRenderArtifacts();

  if (PLATFORM === "chatgpt") {
    startChatGptIntegration();
    return;
  }

  observeRoot(document.body);
  scheduleScan(document);
}

function cleanupLegacyAutoRenderArtifacts(): void {
  document.querySelectorAll(".sp-diagram-card").forEach((element) => element.remove());
  document.querySelectorAll(".sp-inline-diagram").forEach((element) => element.remove());
  document.querySelectorAll(".sp-code-render-button").forEach((element) => element.remove());
  document.querySelectorAll(".sp-cgpt-card").forEach((element) => element.remove());
  document.querySelectorAll(".sp-cgpt-btn").forEach((element) => element.remove());
  document
    .querySelectorAll(
      "[data-show-pic-render-key], [data-show-pic-pending-render-key], [data-show-pic-button-key], [data-show-pic-cgpt]"
    )
    .forEach((element) => {
      element.removeAttribute("data-show-pic-render-key");
      element.removeAttribute("data-show-pic-pending-render-key");
      element.removeAttribute("data-show-pic-button-key");
      element.removeAttribute("data-show-pic-cgpt");
    });
}

async function waitForDocumentBody(): Promise<void> {
  if (document.body) {
    return;
  }

  await new Promise<void>((resolve) => {
    window.addEventListener("DOMContentLoaded", () => resolve(), { once: true });
  });
}

function scheduleScan(root: ParentNode): void {
  pendingScanRoots.add(root);

  if (scanTimer !== undefined) {
    window.clearTimeout(scanTimer);
  }

  scanTimer = window.setTimeout(() => {
    scanTimer = undefined;
    const roots = Array.from(pendingScanRoots);
    pendingScanRoots.clear();
    for (const pendingRoot of roots) {
      scanForDiagrams(pendingRoot);
    }
  }, SCAN_DEBOUNCE_MS);
}

function scheduleScanForMutations(records: MutationRecord[]): void {
  for (const record of records) {
    if (record.target instanceof Element) {
      scheduleScan(record.target);
    } else if (record.target.parentElement) {
      scheduleScan(record.target.parentElement);
    }

    for (const node of Array.from(record.addedNodes)) {
      if (node instanceof Element || node instanceof DocumentFragment) {
        observeNestedShadowRoots(node);
        scheduleScan(node);
      }
    }
  }
}

function scanForDiagrams(root: ParentNode): void {
  const blocks = collectCodeBlocks(root);

  for (const block of blocks) {
    const source = readCleanTextContent(block);
    const diagram = detectDiagram(source, extractLanguageHints(block));
    if (!diagram) {
      continue;
    }

    if (!shouldRenderDiagram()) {
      continue;
    }

    const renderKey = createRenderKey(diagram);
    if (block.getAttribute(BUTTON_KEY_ATTRIBUTE) === renderKey) {
      continue;
    }

    attachRenderButton(block, diagram, renderKey);
  }
}

const INJECTED_CLASS_NAMES = [
  "sp-inline-diagram",
  "sp-diagram-card",
  "sp-code-render-button",
  "sp-cgpt-card",
  "sp-cgpt-btn"
];

function isInjectedNode(node: Node): boolean {
  if (!(node instanceof Element)) return false;
  for (const className of INJECTED_CLASS_NAMES) {
    if (node.classList.contains(className)) return true;
  }
  return false;
}

function readCleanTextContent(root: Node): string {
  let buffer = "";
  const visit = (node: Node): void => {
    if (isInjectedNode(node)) return;
    if (node.nodeType === Node.TEXT_NODE) {
      buffer += node.textContent ?? "";
      return;
    }
    for (const child of Array.from(node.childNodes)) visit(child);
  };
  visit(root);
  return buffer;
}

function collectCodeBlocks(root: ParentNode): HTMLElement[] {
  const blocks = new Set<HTMLElement>();

  if (root instanceof HTMLElement) {
    const closestCodeBlock = root.closest(CODE_BLOCK_SELECTOR);
    if (closestCodeBlock instanceof HTMLElement && isCodeBlock(closestCodeBlock)) {
      blocks.add(resolveRenderableBlock(closestCodeBlock));
    }

    if (isCodeBlock(root)) {
      blocks.add(resolveRenderableBlock(root));
    }
  }

  for (const element of Array.from(root.querySelectorAll(CODE_BLOCK_SELECTOR))) {
    if (element instanceof HTMLElement && isCodeBlock(element)) {
      blocks.add(resolveRenderableBlock(element));
    }
  }

  for (const element of Array.from(root.querySelectorAll("*"))) {
    if (element instanceof HTMLElement && isLikelyDiagramTextBlock(element)) {
      blocks.add(element);
    }

    if (element.shadowRoot) {
      observeRoot(element.shadowRoot);
      for (const block of collectCodeBlocks(element.shadowRoot)) {
        blocks.add(block);
      }
    }
  }

  return dedupeNestedCodeBlocks(Array.from(blocks));
}

function isCodeBlock(element: HTMLElement): boolean {
  return element.matches(CODE_BLOCK_SELECTOR);
}

function resolveRenderableBlock(element: HTMLElement): HTMLElement {
  if (element.matches("code-block, [class*='code-block'], [class*='codeBlock']")) {
    const code = element.querySelector(
      "[data-test-id='code-content'], [data-testid='code-content'], pre code, code, pre"
    );
    return code instanceof HTMLElement ? code : element;
  }

  if (element.matches("pre")) {
    const code = element.querySelector("code");
    return code instanceof HTMLElement ? code : element;
  }

  return element;
}

function isLikelyDiagramTextBlock(element: HTMLElement): boolean {
  const text = readCleanTextContent(element).trim();
  if (text.length < 12 || text.length > 40_000) {
    return false;
  }

  if (!/(@start[a-z0-9_-]*|```(?:mermaid|plantuml|puml)|\b(?:flowchart|sequenceDiagram|classDiagram|graph)\b)/iu.test(text)) {
    return false;
  }

  return detectDiagram(text, extractLanguageHints(element)) !== null;
}

function dedupeNestedCodeBlocks(blocks: HTMLElement[]): HTMLElement[] {
  const diagramKeys = new Map<HTMLElement, string>();

  for (const block of blocks) {
    const diagram = detectDiagram(readCleanTextContent(block), extractLanguageHints(block));
    if (diagram) {
      diagramKeys.set(block, createRenderKey(diagram));
    }
  }

  return blocks.filter((block) => {
    const key = diagramKeys.get(block);
    if (!key) {
      return true;
    }

    return !blocks.some((other) => other !== block && block.contains(other) && diagramKeys.get(other) === key);
  });
}

function observeRoot(root: Node): void {
  if (observedRoots.has(root)) {
    return;
  }

  observedRoots.add(root);
  new MutationObserver((records) => scheduleScanForMutations(records)).observe(root, {
    childList: true,
    subtree: true,
    characterData: true
  });
  observeNestedShadowRoots(root);
}

function observeNestedShadowRoots(root: Node): void {
  if (!(root instanceof Element || root instanceof DocumentFragment)) {
    return;
  }

  const elements = root instanceof Element ? [root, ...Array.from(root.querySelectorAll("*"))] : Array.from(root.querySelectorAll("*"));
  for (const element of elements) {
    if (element.shadowRoot) {
      observeRoot(element.shadowRoot);
    }
  }
}

function attachRenderButton(block: HTMLElement, diagram: DetectedDiagram, renderKey: string): void {
  const sourceBlock = findSourceBlock(block);

  block.setAttribute(BUTTON_KEY_ATTRIBUTE, renderKey);

  if (sourceBlock.dataset.showPicButtonKey === renderKey && sourceBlock.querySelector(".sp-code-render-button")) {
    return;
  }

  for (const existing of Array.from(sourceBlock.querySelectorAll<HTMLButtonElement>(".sp-code-render-button"))) {
    existing.remove();
  }

  sourceBlock.dataset.showPicButtonKey = renderKey;

  const toolbar = findToolbar(sourceBlock);
  const button = document.createElement("button");
  button.type = "button";
  button.className = `sp-code-render-button sp-code-render-button--${diagram.type}`;
  button.textContent = diagram.type === "plantuml" ? "PlantUML" : "Mermaid";
  button.title = `Render ${diagram.type === "plantuml" ? "PlantUML" : "Mermaid"} diagram`;
  button.addEventListener("click", () => {
    void renderDiagramBlock(block, diagram, button);
  });

  if (toolbar) {
    button.classList.add("sp-code-render-button--in-toolbar");
    toolbar.append(button);
  } else {
    sourceBlock.classList.add("sp-code-block-with-button");
    sourceBlock.append(button);
  }
}

async function renderDiagramBlock(
  block: HTMLElement,
  diagram: DetectedDiagram,
  triggerButton: HTMLButtonElement
): Promise<void> {
  const surface = getOrCreateInlineSurface(block);
  const settings = await loadSettings();

  const liveDiagram = resolveLiveDiagram(block, diagram);
  console.info("[Show Pic] Rendering diagram", {
    type: liveDiagram.type,
    capturedLength: diagram.source.length,
    liveLength: liveDiagram.source.length,
    preview: liveDiagram.source.slice(0, 160)
  });

  const plantUmlUrl =
    liveDiagram.type === "plantuml"
      ? await createPlantUmlSvgUrl(liveDiagram.source, settings.plantumlServerBaseUrl)
      : undefined;

  if (plantUmlUrl) {
    console.info("[Show Pic] PlantUML request", { url: plantUmlUrl });
  }

  try {
    triggerButton.disabled = true;
    triggerButton.textContent = "Rendering...";
    surface.setLoading();

    if (liveDiagram.type === "mermaid") {
      const svg = await renderMermaidDiagram(liveDiagram.source);
      surface.setSvg(svg);
      triggerButton.textContent = "Mermaid";
      return;
    }

    if (!plantUmlUrl) {
      throw new Error("PlantUML server URL is not configured.");
    }

    try {
      const svg = await fetchPlantUmlSvg(plantUmlUrl);
      surface.setSvg(svg);
      triggerButton.textContent = "PlantUML";
    } catch (error) {
      surface.setError(error instanceof Error ? error.message : "PlantUML rendering failed.");
    }
  } catch (error) {
    surface.setError(error instanceof Error ? error.message : "Diagram rendering failed.");
  } finally {
    triggerButton.disabled = false;
  }
}

function resolveLiveDiagram(block: HTMLElement, fallback: DetectedDiagram): DetectedDiagram {
  const candidates = collectLiveSourceCandidates(block);
  let best = fallback;

  for (const text of candidates) {
    const detected = detectDiagram(text, extractLanguageHints(block));
    if (!detected || detected.type !== fallback.type) {
      continue;
    }

    if (detected.source.length > best.source.length) {
      best = detected;
    }
  }

  return best;
}

function collectLiveSourceCandidates(block: HTMLElement): string[] {
  const texts: string[] = [];
  const seen = new Set<string>();
  const push = (value: string | null | undefined): void => {
    const trimmed = (value ?? "").trim();
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed);
      texts.push(trimmed);
    }
  };

  push(readElementText(block));

  const sourceBlock = findSourceBlock(block);
  push(readElementText(sourceBlock));

  const innerSelectors = [
    "[data-test-id='code-content']",
    "[data-testid='code-content']",
    "pre code",
    "pre",
    "code"
  ];
  for (const selector of innerSelectors) {
    for (const element of Array.from(sourceBlock.querySelectorAll(selector))) {
      if (element instanceof HTMLElement) {
        push(readElementText(element));
      }
    }
  }

  return texts;
}

function readElementText(element: HTMLElement): string {
  const containsInjected = element.querySelector(
    INJECTED_CLASS_NAMES.map((name) => `.${name}`).join(",")
  );

  if (!containsInjected) {
    const layoutAware = typeof element.innerText === "string" ? element.innerText : "";
    if (layoutAware.includes("\n")) {
      return layoutAware;
    }
  }

  const text = readCleanTextContent(element);
  if (text.includes("\n")) {
    return text;
  }

  const walked = serializeBlockAware(element);
  if (walked.includes("\n")) {
    return walked;
  }

  return text;
}

const BLOCK_LEVEL_TAGS = new Set([
  "ADDRESS",
  "ARTICLE",
  "ASIDE",
  "BLOCKQUOTE",
  "DD",
  "DETAILS",
  "DIALOG",
  "DIV",
  "DL",
  "DT",
  "FIELDSET",
  "FIGCAPTION",
  "FIGURE",
  "FOOTER",
  "FORM",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "HEADER",
  "HR",
  "LI",
  "MAIN",
  "NAV",
  "OL",
  "P",
  "PRE",
  "SECTION",
  "TABLE",
  "TBODY",
  "TD",
  "TFOOT",
  "TH",
  "THEAD",
  "TR",
  "UL"
]);

function serializeBlockAware(root: Node): string {
  let result = "";

  const visit = (node: Node): void => {
    if (isInjectedNode(node)) {
      return;
    }
    if (node.nodeType === Node.TEXT_NODE) {
      result += node.textContent ?? "";
      return;
    }

    if (!(node instanceof Element)) {
      return;
    }

    if (node.tagName === "BR") {
      result += "\n";
      return;
    }

    const isBlock = BLOCK_LEVEL_TAGS.has(node.tagName) || isBlockByClass(node);
    if (isBlock && result.length > 0 && !result.endsWith("\n")) {
      result += "\n";
    }

    for (const child of Array.from(node.childNodes)) {
      visit(child);
    }

    if (isBlock && !result.endsWith("\n")) {
      result += "\n";
    }
  };

  visit(root);
  return result;
}

function isBlockByClass(element: Element): boolean {
  const className = element.className;
  if (typeof className !== "string") {
    return false;
  }
  return /\b(line|row)\b/iu.test(className);
}

function findSourceBlock(block: HTMLElement): HTMLElement {
  const component = block.closest("code-block");
  if (component instanceof HTMLElement) {
    return component;
  }

  const codeBlockContainer = block.closest("[class*='code-block'], [class*='codeBlock']");
  if (codeBlockContainer instanceof HTMLElement) {
    return codeBlockContainer;
  }

  const closestPre = block.closest("pre");
  return closestPre instanceof HTMLElement ? closestPre : block;
}

function findSourceContent(block: HTMLElement): HTMLElement {
  const closestPre = block.closest("pre");
  if (closestPre instanceof HTMLElement) {
    return closestPre;
  }

  return block;
}

function findToolbar(sourceBlock: HTMLElement): HTMLElement | null {
  const native = findNativeToolbar(sourceBlock);
  if (native) {
    return native;
  }

  return (
    sourceBlock.querySelector<HTMLElement>("[class*='buttons']") ??
    sourceBlock.querySelector<HTMLElement>("[class*='actions']") ??
    sourceBlock.querySelector<HTMLElement>("[data-test-id*='toolbar']") ??
    sourceBlock.querySelector<HTMLElement>("[data-testid*='toolbar']")
  );
}

function findNativeToolbar(sourceBlock: HTMLElement): HTMLElement | null {
  const pre = sourceBlock.closest("pre") ?? sourceBlock.querySelector("pre") ?? sourceBlock;
  let current: HTMLElement | null = pre instanceof HTMLElement ? pre : sourceBlock;

  for (let depth = 0; depth < 8 && current; depth += 1) {
    const parentEl: HTMLElement | null = current.parentElement;
    if (!parentEl) {
      break;
    }

    for (const sibling of Array.from(parentEl.children)) {
      if (!(sibling instanceof HTMLElement)) continue;
      if (sibling === current || sibling.contains(current)) continue;
      if (sibling.tagName === "PRE" || sibling.querySelector("pre")) continue;

      const candidate = pickActionContainer(sibling);
      if (candidate) {
        return candidate;
      }
    }

    current = parentEl;
  }

  return null;
}

function pickActionContainer(header: HTMLElement): HTMLElement | null {
  const buttons = Array.from(header.querySelectorAll<HTMLButtonElement>("button"));
  const usable = buttons.filter((btn) => !btn.classList.contains("sp-code-render-button"));
  if (usable.length === 0) {
    return null;
  }

  const last = usable[usable.length - 1];
  return last?.parentElement ?? header;
}

function getOrCreateInlineSurface(block: HTMLElement): InlineDiagramSurface {
  const existing = renderSurfaces.get(block);
  if (existing) {
    existing.root.hidden = false;
    existing.sourceContent.hidden = true;
    return existing;
  }

  const sourceContent = findSourceContent(block);
  const sourceBlock = findSourceBlock(block);
  const root = document.createElement("div");
  root.className = "sp-inline-diagram";

  const controls = document.createElement("div");
  controls.className = "sp-inline-diagram__controls";

  const zoomOutButton = createInlineButton("−", "Zoom out");
  const zoomLabel = document.createElement("span");
  zoomLabel.className = "sp-inline-diagram__zoom";
  zoomLabel.textContent = "100%";
  const resetButton = createInlineButton("1:1", "Reset zoom");
  const zoomInButton = createInlineButton("+", "Zoom in");
  const sourceButton = createInlineButton("Source", "Show source");
  const downloadButton = createInlineButton("Download", "Download SVG");

  controls.append(zoomOutButton, zoomLabel, resetButton, zoomInButton, sourceButton, downloadButton);

  const viewport = document.createElement("div");
  viewport.className = "sp-inline-diagram__viewport";

  const canvas = document.createElement("div");
  canvas.className = "sp-inline-diagram__canvas";
  viewport.append(canvas);

  root.append(controls, viewport);
  sourceContent.insertAdjacentElement("afterend", root);
  sourceContent.hidden = true;

  let scale = 1;
  let translateX = 0;
  let translateY = 0;
  let latestSvg = "";
  let dragStart: { pointerId: number; x: number; y: number; translateX: number; translateY: number } | null = null;

  const applyTransform = () => {
    canvas.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    zoomLabel.textContent = `${Math.round(scale * 100)}%`;
  };

  const setScale = (nextScale: number) => {
    scale = Math.min(6, Math.max(0.2, nextScale));
    applyTransform();
  };

  const resetView = () => {
    scale = 1;
    translateX = 0;
    translateY = 0;
    applyTransform();
  };

  zoomOutButton.addEventListener("click", () => setScale(scale - 0.25));
  zoomInButton.addEventListener("click", () => setScale(scale + 0.25));
  resetButton.addEventListener("click", resetView);
  sourceButton.addEventListener("click", () => {
    root.hidden = true;
    sourceContent.hidden = false;
  });
  downloadButton.addEventListener("click", () => downloadSvg(latestSvg));

  viewport.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      setScale(scale + (event.deltaY < 0 ? 0.15 : -0.15));
    },
    { passive: false }
  );

  viewport.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    viewport.setPointerCapture(event.pointerId);
    dragStart = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      translateX,
      translateY
    };
  });

  viewport.addEventListener("pointermove", (event) => {
    if (!dragStart || dragStart.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    translateX = dragStart.translateX + event.clientX - dragStart.x;
    translateY = dragStart.translateY + event.clientY - dragStart.y;
    applyTransform();
  });

  viewport.addEventListener("pointerup", () => {
    dragStart = null;
  });

  viewport.addEventListener("pointercancel", () => {
    dragStart = null;
  });

  const surface: InlineDiagramSurface = {
    root,
    sourceContent,
    canvas,
    zoomLabel,
    setLoading: () => {
      sourceContent.hidden = true;
      root.hidden = false;
      canvas.className = "sp-inline-diagram__canvas sp-inline-diagram__canvas--message";
      canvas.textContent = "Rendering diagram...";
    },
    setSvg: (svg) => {
      latestSvg = svg;
      canvas.className = "sp-inline-diagram__canvas";
      canvas.innerHTML = svg;
      resetView();
    },
    setError: (message) => {
      canvas.className = "sp-inline-diagram__canvas sp-inline-diagram__canvas--error";
      canvas.textContent = message;
    }
  };

  renderSurfaces.set(block, surface);
  sourceBlock.dataset.showPicHasInlineDiagram = "true";
  applyTransform();
  return surface;
}

function createInlineButton(label: string, title = label): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "sp-inline-diagram__button";
  button.textContent = label;
  button.title = title;
  button.setAttribute("aria-label", title);
  return button;
}

function downloadSvg(svg: string): void {
  if (!svg) {
    return;
  }

  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "show-pic-diagram.svg";
  link.click();
  URL.revokeObjectURL(url);
}

async function fetchPlantUmlSvg(url: string): Promise<string> {
  const message: FetchPlantUmlSvgMessage = {
    type: "show-pic-fetch-plantuml-svg",
    url
  };
  const response = (await chrome.runtime.sendMessage(message)) as FetchPlantUmlSvgResponse | undefined;

  if (!response) {
    throw new Error("PlantUML renderer did not respond.");
  }

  if (!response.ok) {
    throw new Error(response.error);
  }

  return sanitizeSvg(response.svg);
}

function createRenderKey(diagram: DetectedDiagram): string {
  return `${diagram.type}:${hashString(diagram.source)}`;
}

function hashString(value: string): string {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(36);
}
