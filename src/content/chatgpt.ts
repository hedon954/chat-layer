import { createPlantUmlSvgUrl, normalizePlantUmlSource } from "../render/plantuml";
import { sanitizeSvg } from "../render/svg";
import type {
  FetchPlantUmlSvgMessage,
  FetchPlantUmlSvgResponse
} from "../shared/plantuml-render";
import { loadSettings } from "../shared/settings";
import { initChatGptToc } from "./toc-chatgpt";

const BUTTON_CLASS = "sp-cgpt-btn";
const CARD_CLASS = "sp-cgpt-card";
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
      if (sibling instanceof HTMLElement) {
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
  const inner = typeof body.innerText === "string" ? body.innerText : "";
  if (inner) candidates.push(inner);
  const text = body.textContent ?? "";
  if (text) candidates.push(text);
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
  const sibling = pre.nextElementSibling;
  if (sibling instanceof HTMLElement && sibling.classList.contains(CARD_CLASS)) {
    const existing = (sibling as DiagramCardElement).__card;
    if (existing) return existing;
  }
  const card = createCard();
  pre.insertAdjacentElement("afterend", card.root);
  (card.root as DiagramCardElement).__card = card;
  return card;
}

type DiagramCardElement = HTMLElement & { __card?: DiagramCard };

type DiagramCard = {
  root: HTMLElement;
  setLoading: () => void;
  setSvg: (svg: string) => void;
  setError: (message: string) => void;
};

function createCard(): DiagramCard {
  const root = document.createElement("div");
  root.className = CARD_CLASS;

  const controls = document.createElement("div");
  controls.className = `${CARD_CLASS}__controls`;

  const zoomOut = makeBtn("−", "Zoom out");
  const zoomLabel = document.createElement("span");
  zoomLabel.className = `${CARD_CLASS}__zoom`;
  zoomLabel.textContent = "100%";
  const zoomReset = makeBtn("1:1", "Reset");
  const zoomIn = makeBtn("+", "Zoom in");
  const fitBtn = makeBtn("Fit", "Fit width");
  const downloadBtn = makeBtn("Download", "Download SVG");
  const closeBtn = makeBtn("Close", "Hide diagram");

  controls.append(zoomOut, zoomLabel, zoomReset, zoomIn, fitBtn, downloadBtn, closeBtn);

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
  closeBtn.addEventListener("click", () => {
    root.hidden = true;
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

  return {
    root,
    setLoading: () => {
      root.hidden = false;
      canvas.className = `${CARD_CLASS}__canvas ${CARD_CLASS}__canvas--message`;
      canvas.textContent = "Rendering diagram...";
    },
    setSvg: (svg) => {
      latestSvg = svg;
      root.hidden = false;
      canvas.className = `${CARD_CLASS}__canvas`;
      canvas.innerHTML = svg;
      reset();
      requestAnimationFrame(fit);
    },
    setError: (message) => {
      root.hidden = false;
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
