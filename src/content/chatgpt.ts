import { createPlantUmlSvgUrl, normalizePlantUmlSource } from "../render/plantuml";
import { sanitizeSvg } from "../render/svg";
import type {
  FetchPlantUmlSvgMessage,
  FetchPlantUmlSvgResponse
} from "../shared/plantuml-render";
import { loadSettings } from "../shared/settings";
import { applyCompactDiagramSize } from "./diagram-size";
import {
  applyInlineDiagramViewToGroup,
  type InlineDiagramView
} from "./diagram-view";
import { initChatGptToc } from "./toc-chatgpt";

const BUTTON_CLASS = "sp-cgpt-btn";
const CARD_CLASS = "sp-cgpt-card";
const SOURCE_CLASS = "sp-cgpt-source";
const SHOWING_DIAGRAM_CLASS = "sp-cgpt-showing-diagram";
const PROCESSED_FLAG = "data-show-pic-cgpt";
const SCAN_DEBOUNCE_MS = 200;
const PLANTUML_LANGUAGES = new Set(["plantuml", "puml"]);

export function startChatGptIntegration(): void {
  console.info("[ChatLayer] ChatGPT integration active.");
  scheduleScan();
  new MutationObserver(() => scheduleScan()).observe(document.body, {
    childList: true,
    subtree: true
  });
  void initChatGptToc();
}

let scanTimer: number | undefined;

function scheduleScan(): void {
  if (scanTimer !== undefined) return;
  scanTimer = window.setTimeout(() => {
    scanTimer = undefined;
    scan();
  }, SCAN_DEBOUNCE_MS);
}

function scan(): void {
  for (const pre of Array.from(document.querySelectorAll<HTMLPreElement>("pre"))) {
    if (pre.getAttribute(PROCESSED_FLAG) === "1") continue;
    const language = readLanguageLabel(pre);
    if (!PLANTUML_LANGUAGES.has(language)) continue;

    const toolbar = findToolbar(pre);
    if (!toolbar) continue;

    if (!toolbar.querySelector(`.${BUTTON_CLASS}`)) {
      attachButton(toolbar, pre);
    }
    pre.setAttribute(PROCESSED_FLAG, "1");
  }
}

function readLanguageLabel(pre: HTMLElement): string {
  const candidates: (Element | null)[] = [
    pre.querySelector("[class*='justify-self-start']"),
    pre.querySelector(".sticky [class*='font-medium']"),
    pre.querySelector("[class*='sticky'] [class*='font-medium']")
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const text = (candidate.textContent ?? "").trim().toLowerCase();
    if (text.length === 0 || text.length > 24) continue;
    return text.split(/\s+/u)[0] ?? text;
  }
  return "";
}

function findToolbar(pre: HTMLElement): HTMLElement | null {
  const actions = pre.querySelector<HTMLElement>("[class*='justify-self-end']");
  if (actions) return actions;
  const sticky =
    pre.querySelector<HTMLElement>(".sticky") ?? pre.querySelector<HTMLElement>("[class*='sticky']");
  if (sticky) {
    const buttons = sticky.querySelectorAll<HTMLButtonElement>("button");
    if (buttons.length > 0) {
      const last = buttons[buttons.length - 1];
      return last?.parentElement ?? sticky;
    }
    return sticky;
  }
  return null;
}

function findCodeBody(pre: HTMLElement): HTMLElement {
  const sticky =
    pre.querySelector<HTMLElement>(".sticky") ?? pre.querySelector<HTMLElement>("[class*='sticky']");
  if (sticky) {
    let sibling = sticky.nextElementSibling;
    while (sibling) {
      if (
        sibling instanceof HTMLElement &&
        !sibling.classList.contains(CARD_CLASS) &&
        !sibling.classList.contains(BUTTON_CLASS)
      ) {
        const text = (sibling.textContent ?? "").trim();
        if (text.length > 0) return sibling;
      }
      sibling = sibling.nextElementSibling;
    }
  }
  return pre;
}

function attachButton(toolbar: HTMLElement, pre: HTMLElement): void {
  const button = document.createElement("button");
  button.type = "button";
  button.className = BUTTON_CLASS;
  button.textContent = "PlantUML";
  button.title = "Render PlantUML diagram";
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    void handleRenderClick(pre, button);
  });
  toolbar.append(button);
}

async function handleRenderClick(pre: HTMLElement, button: HTMLButtonElement): Promise<void> {
  const card = ensureCard(pre);
  if (card.hasSvg() && card.root.hidden) {
    card.showDiagram();
    return;
  }

  const body = findCodeBody(pre);
  const rawSource = extractSource(body);
  const source = normalizePlantUmlSource(rawSource);
  console.info("[ChatLayer ChatGPT] render", {
    rawLength: rawSource.length,
    sourceLength: source.length,
    preview: source.slice(0, 240)
  });

  card.setLoading();
  button.disabled = true;
  button.textContent = "Rendering...";

  try {
    const settings = await loadSettings();
    const url = await createPlantUmlSvgUrl(source, settings.plantumlServerBaseUrl);
    console.info("[ChatLayer ChatGPT] request", { url });
    const svg = await fetchPlantUmlSvg(url);
    card.setSvg(svg);
  } catch (error) {
    card.setError(error instanceof Error ? error.message : String(error));
  } finally {
    button.disabled = false;
    button.textContent = "PlantUML";
  }
}

function extractSource(body: HTMLElement): string {
  const candidates: string[] = [];
  const containsInjected = Boolean(body.querySelector(`.${CARD_CLASS}, .${BUTTON_CLASS}`));
  if (!containsInjected) {
    const inner = typeof body.innerText === "string" ? body.innerText : "";
    if (inner) candidates.push(inner);
    const text = body.textContent ?? "";
    if (text) candidates.push(text);
  }
  candidates.push(walkBlockAware(body));

  let best = "";
  for (const candidate of candidates) {
    const trimmed = candidate.trim();
    if (trimmed.length === 0) continue;
    if (trimmed.includes("\n") && !best.includes("\n")) {
      best = trimmed;
      continue;
    }
    if (trimmed.length > best.length) {
      best = trimmed;
    }
  }
  return best;
}

const BLOCK_TAGS = new Set([
  "DIV",
  "P",
  "PRE",
  "LI",
  "TR",
  "SECTION",
  "ARTICLE",
  "HEADER",
  "FOOTER",
  "MAIN",
  "NAV",
  "ASIDE",
  "BLOCKQUOTE",
  "FIGURE",
  "FIGCAPTION",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6"
]);

function walkBlockAware(root: Node): string {
  let buffer = "";

  const visit = (node: Node): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      buffer += node.textContent ?? "";
      return;
    }
    if (!(node instanceof Element)) return;
    if (node.classList.contains(CARD_CLASS) || node.classList.contains(BUTTON_CLASS)) return;
    if (node.tagName === "BR") {
      buffer += "\n";
      return;
    }
    const isBlock =
      BLOCK_TAGS.has(node.tagName) ||
      /\b(?:line|row|hljs-ln-line)\b/iu.test(
        typeof node.className === "string" ? node.className : ""
      );
    if (isBlock && buffer.length > 0 && !buffer.endsWith("\n")) buffer += "\n";
    for (const child of Array.from(node.childNodes)) visit(child);
    if (isBlock && !buffer.endsWith("\n")) buffer += "\n";
  };

  visit(root);
  return buffer;
}

function ensureCard(pre: HTMLElement): DiagramCard {
  const sourceContent = findCodeBody(pre);
  const existingRoot = findCardRoot(pre, sourceContent);
  if (existingRoot) {
    const existing = (existingRoot as DiagramCardElement).__card;
    if (existing) {
      placeCard(pre, sourceContent, existingRoot);
      return existing;
    }
  }

  const card = createCard(pre, sourceContent);
  placeCard(pre, sourceContent, card.root);
  (card.root as DiagramCardElement).__card = card;
  return card;
}

function findCardRoot(pre: HTMLElement, sourceContent: HTMLElement): HTMLElement | null {
  const afterSource = sourceContent.nextElementSibling;
  if (afterSource instanceof HTMLElement && afterSource.classList.contains(CARD_CLASS)) {
    return afterSource;
  }

  const inside = pre.querySelector<HTMLElement>(`:scope > .${CARD_CLASS}`);
  if (inside) {
    return inside;
  }

  const afterPre = pre.nextElementSibling;
  if (afterPre instanceof HTMLElement && afterPre.classList.contains(CARD_CLASS)) {
    return afterPre;
  }

  return null;
}

function placeCard(pre: HTMLElement, sourceContent: HTMLElement, cardRoot: HTMLElement): void {
  if (sourceContent !== pre) {
    if (sourceContent.nextElementSibling !== cardRoot) {
      sourceContent.insertAdjacentElement("afterend", cardRoot);
    }
    return;
  }

  const sticky = findStickyHeader(pre);
  if (sticky && cardRoot.previousElementSibling !== sticky) {
    sticky.insertAdjacentElement("afterend", cardRoot);
    return;
  }

  if (cardRoot.parentElement !== pre) {
    pre.append(cardRoot);
  }
}

function findStickyHeader(pre: HTMLElement): HTMLElement | null {
  return (
    pre.querySelector<HTMLElement>(":scope > .sticky") ??
    pre.querySelector<HTMLElement>(':scope > [class*="sticky"]')
  );
}

function collectSourceElements(pre: HTMLElement, sourceContent: HTMLElement, cardRoot: HTMLElement): HTMLElement[] {
  const elements =
    sourceContent !== pre
      ? [sourceContent]
      : Array.from(pre.children).filter((child): child is HTMLElement => {
          return (
            child instanceof HTMLElement &&
            child !== cardRoot &&
            !child.classList.contains(CARD_CLASS) &&
            !isToolbarLike(child)
          );
        });

  for (const element of elements) {
    element.classList.add(SOURCE_CLASS);
  }
  return elements;
}

function isToolbarLike(element: HTMLElement): boolean {
  if (element.classList.contains("sticky")) {
    return true;
  }
  const className = typeof element.className === "string" ? element.className : "";
  return className.includes("sticky");
}

function setDiagramView(pre: HTMLElement, sourceContent: HTMLElement, cardRoot: HTMLElement, view: InlineDiagramView): void {
  applyInlineDiagramViewToGroup(collectSourceElements(pre, sourceContent, cardRoot), cardRoot, view);
  pre.classList.toggle(SHOWING_DIAGRAM_CLASS, view === "diagram");
}

type DiagramCardElement = HTMLElement & { __card?: DiagramCard };

type DiagramCard = {
  root: HTMLElement;
  hasSvg: () => boolean;
  showDiagram: () => void;
  setLoading: () => void;
  setSvg: (svg: string) => void;
  setError: (message: string) => void;
};

function createCard(pre: HTMLElement, sourceContent: HTMLElement): DiagramCard {
  const root = document.createElement("div");
  root.className = CARD_CLASS;
  root.hidden = true;

  const controls = document.createElement("div");
  controls.className = `${CARD_CLASS}__controls`;

  const zoomOut = makeBtn("−", "Zoom out");
  const zoomLabel = document.createElement("span");
  zoomLabel.className = `${CARD_CLASS}__zoom`;
  zoomLabel.textContent = "100%";
  const zoomReset = makeBtn("1:1", "Reset");
  const zoomIn = makeBtn("+", "Zoom in");
  const fitBtn = makeBtn("Fit", "Fit width");
  const sourceBtn = makeBtn("Source", "Show source");
  const downloadBtn = makeBtn("Download", "Download SVG");

  controls.append(zoomOut, zoomLabel, zoomReset, zoomIn, fitBtn, sourceBtn, downloadBtn);

  const viewport = document.createElement("div");
  viewport.className = `${CARD_CLASS}__viewport`;
  const canvas = document.createElement("div");
  canvas.className = `${CARD_CLASS}__canvas`;
  viewport.append(canvas);
  root.append(controls, viewport);

  let scale = 1;
  let translateX = 0;
  let translateY = 0;
  let latestSvg = "";
  let drag: { id: number; x: number; y: number; tx: number; ty: number } | null = null;

  const apply = (): void => {
    canvas.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    zoomLabel.textContent = `${Math.round(scale * 100)}%`;
  };
  const setScale = (value: number): void => {
    scale = Math.min(8, Math.max(0.1, value));
    apply();
  };
  const reset = (): void => {
    scale = 1;
    translateX = 0;
    translateY = 0;
    apply();
  };
  const fit = (): void => {
    const svg = canvas.querySelector("svg");
    if (!(svg instanceof SVGSVGElement)) return;
    const vw = viewport.clientWidth - 32;
    const sw = svg.getBoundingClientRect().width;
    if (sw > 0) setScale(vw / sw);
    translateX = 0;
    translateY = 0;
    apply();
  };

  zoomOut.addEventListener("click", () => setScale(scale - 0.2));
  zoomIn.addEventListener("click", () => setScale(scale + 0.2));
  zoomReset.addEventListener("click", reset);
  fitBtn.addEventListener("click", fit);
  sourceBtn.addEventListener("click", () => {
    setDiagramView(pre, sourceContent, root, "source");
  });
  downloadBtn.addEventListener("click", () => {
    if (!latestSvg) return;
    const url = URL.createObjectURL(new Blob([latestSvg], { type: "image/svg+xml" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "chatlayer-diagram.svg";
    a.click();
    URL.revokeObjectURL(url);
  });

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
    drag = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      tx: translateX,
      ty: translateY
    };
  });
  viewport.addEventListener("pointermove", (event) => {
    if (!drag || drag.id !== event.pointerId) return;
    event.preventDefault();
    translateX = drag.tx + event.clientX - drag.x;
    translateY = drag.ty + event.clientY - drag.y;
    apply();
  });
  viewport.addEventListener("pointerup", () => {
    drag = null;
  });
  viewport.addEventListener("pointercancel", () => {
    drag = null;
  });

  const showDiagram = (): void => {
    setDiagramView(pre, sourceContent, root, "diagram");
  };

  return {
    root,
    hasSvg: () => latestSvg.length > 0,
    showDiagram,
    setLoading: () => {
      showDiagram();
      viewport.style.height = "";
      canvas.className = `${CARD_CLASS}__canvas ${CARD_CLASS}__canvas--message`;
      canvas.textContent = "Rendering diagram...";
    },
    setSvg: (svg) => {
      latestSvg = svg;
      showDiagram();
      canvas.className = `${CARD_CLASS}__canvas`;
      canvas.innerHTML = svg;
      reset();
      requestAnimationFrame(() => {
        const rendered = canvas.querySelector("svg");
        if (rendered instanceof SVGSVGElement) {
          applyCompactDiagramSize(rendered, viewport);
        }
      });
    },
    setError: (message) => {
      showDiagram();
      viewport.style.height = "";
      canvas.className = `${CARD_CLASS}__canvas ${CARD_CLASS}__canvas--error`;
      canvas.textContent = message;
    }
  };
}

function makeBtn(label: string, title: string): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `${CARD_CLASS}__button`;
  btn.textContent = label;
  btn.title = title;
  btn.setAttribute("aria-label", title);
  return btn;
}

async function fetchPlantUmlSvg(url: string): Promise<string> {
  const message: FetchPlantUmlSvgMessage = {
    type: "show-pic-fetch-plantuml-svg",
    url
  };
  const response = (await chrome.runtime.sendMessage(message)) as
    | FetchPlantUmlSvgResponse
    | undefined;
  if (!response) throw new Error("PlantUML renderer did not respond.");
  if (!response.ok) throw new Error(response.error);
  return sanitizeSvg(response.svg);
}
