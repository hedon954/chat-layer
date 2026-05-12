import type { ViewerContent, ViewerPayload } from "../shared/viewer";
import { createViewerStorageKey } from "../shared/viewer";

import "./styles.css";

const root = document.querySelector<HTMLElement>("#viewer-root");

void initializeViewer();

async function initializeViewer(): Promise<void> {
  if (!root) {
    return;
  }

  const viewerId = new URLSearchParams(location.search).get("id");
  if (!viewerId) {
    root.textContent = "Missing viewer id.";
    return;
  }

  const storageKey = createViewerStorageKey(viewerId);
  const stored = await chrome.storage.local.get(storageKey);
  const payload = stored[storageKey] as ViewerPayload | undefined;

  if (!payload) {
    root.textContent = "Diagram data was not found.";
    return;
  }

  renderViewer(root, payload);
}

function renderViewer(container: HTMLElement, payload: ViewerPayload): void {
  container.textContent = "";

  const header = document.createElement("header");
  header.className = "viewer-header";

  const title = document.createElement("h1");
  title.textContent = payload.title;

  const actions = document.createElement("div");
  actions.className = "viewer-actions";

  const zoomOutButton = createButton("Zoom Out");
  const zoomValue = document.createElement("span");
  zoomValue.className = "viewer-zoom";
  zoomValue.textContent = "100%";
  const zoomInButton = createButton("Zoom In");
  const resetButton = createButton("Reset");
  const copyButton = createButton("Copy Source");

  actions.append(zoomOutButton, zoomValue, zoomInButton, resetButton, copyButton);

  if (payload.externalUrl) {
    const serverLink = document.createElement("a");
    serverLink.className = "viewer-button";
    serverLink.href = payload.externalUrl;
    serverLink.target = "_blank";
    serverLink.rel = "noreferrer";
    serverLink.textContent = "Open Server";
    actions.append(serverLink);
  }

  header.append(title, actions);

  const viewport = document.createElement("section");
  viewport.className = "viewer-viewport";

  const canvas = document.createElement("div");
  canvas.className = "viewer-canvas";
  renderContent(canvas, payload.content);
  viewport.append(canvas);

  let scale = 1;
  let translateX = 0;
  let translateY = 0;
  let dragStart: { pointerId: number; x: number; y: number; translateX: number; translateY: number } | null = null;

  const applyTransform = () => {
    canvas.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    zoomValue.textContent = `${Math.round(scale * 100)}%`;
  };

  const setScale = (nextScale: number) => {
    scale = Math.min(6, Math.max(0.15, nextScale));
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
  copyButton.addEventListener("click", () => {
    void navigator.clipboard.writeText(payload.source);
  });

  viewport.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      setScale(scale + normalizeWheelDelta(event));
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

  document.addEventListener("keydown", (event) => {
    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      setScale(scale + 0.25);
    } else if (event.key === "-" || event.key === "_") {
      event.preventDefault();
      setScale(scale - 0.25);
    } else if (event.key === "0") {
      event.preventDefault();
      resetView();
    }
  });

  container.append(header, viewport);
  applyTransform();
}

function renderContent(container: HTMLElement, content: ViewerContent): void {
  if (content.kind === "svg") {
    container.innerHTML = content.value;
    return;
  }

  const image = document.createElement("img");
  image.className = "viewer-image";
  image.alt = content.alt;
  image.draggable = false;
  image.src = content.value;
  container.append(image);
}

function createButton(label: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.className = "viewer-button";
  button.type = "button";
  button.textContent = label;
  return button;
}

function normalizeWheelDelta(event: WheelEvent): number {
  if (event.ctrlKey || event.metaKey) {
    return event.deltaY < 0 ? 0.18 : -0.18;
  }

  return event.deltaY < 0 ? 0.12 : -0.12;
}
