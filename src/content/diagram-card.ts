import type { DiagramType } from "./detector";
import {
  createViewerStorageKey,
  type OpenViewerMessage,
  type ViewerContent,
  type ViewerPayload
} from "../shared/viewer";

export type DiagramCard = {
  root: HTMLElement;
  body: HTMLElement;
  setLoading: () => void;
  setSvg: (svg: string) => void;
  setImage: (url: string) => void;
  setError: (message: string) => void;
};

type CreateDiagramCardOptions = {
  type: DiagramType;
  source: string;
  sourceBlock: HTMLElement;
  onRetry: () => void;
  externalUrl?: string;
};

export function createDiagramCard(options: CreateDiagramCardOptions): DiagramCard {
  let renderedContent: ViewerContent | null = null;

  const root = document.createElement("section");
  root.className = "sp-diagram-card";
  root.dataset.showPicDiagramCard = "true";

  const header = document.createElement("div");
  header.className = "sp-diagram-card__header";

  const titleWrap = document.createElement("div");
  titleWrap.className = "sp-diagram-card__heading";

  const eyebrow = document.createElement("span");
  eyebrow.className = "sp-diagram-card__eyebrow";
  eyebrow.textContent = "ChatLayer";

  const title = document.createElement("span");
  title.className = "sp-diagram-card__title";
  title.textContent = `${formatDiagramType(options.type)} Diagram`;

  titleWrap.append(eyebrow, title);

  const actions = document.createElement("div");
  actions.className = "sp-diagram-card__actions";

  const viewButton = createButton("Open Window", () => {
    if (renderedContent) {
      void openFloatingViewer({
        title: `${formatDiagramType(options.type)} Diagram`,
        content: renderedContent,
        source: options.source,
        externalUrl: options.externalUrl
      });
    }
  });
  viewButton.disabled = true;

  const toggleSourceButton = createButton("Source", () => {
    options.sourceBlock.hidden = !options.sourceBlock.hidden;
  });

  const copyButton = createButton("Copy", () => {
    void navigator.clipboard.writeText(options.source);
  });

  const retryButton = createButton("Retry", options.onRetry);

  actions.append(viewButton, toggleSourceButton, copyButton, retryButton);

  if (options.externalUrl) {
    const openLink = document.createElement("a");
    openLink.className = "sp-diagram-card__button";
    openLink.href = options.externalUrl;
    openLink.target = "_blank";
    openLink.rel = "noreferrer";
    openLink.textContent = "Server";
    actions.append(openLink);
  }

  header.append(titleWrap, actions);

  const body = document.createElement("div");
  body.className = "sp-diagram-card__body";

  root.append(header, body);

  return {
    root,
    body,
    setLoading: () => {
      renderedContent = null;
      viewButton.disabled = true;
      body.className = "sp-diagram-card__body sp-diagram-card__body--loading";
      body.innerHTML = '<span class="sp-diagram-card__spinner" aria-hidden="true"></span><span>Rendering diagram...</span>';
    },
    setSvg: (svg) => {
      renderedContent = { kind: "svg", value: svg };
      viewButton.disabled = false;
      body.className = "sp-diagram-card__body";
      body.innerHTML = svg;
    },
    setImage: (url) => {
      const alt = `${formatDiagramType(options.type)} diagram`;
      renderedContent = { kind: "image", value: url, alt };
      viewButton.disabled = false;
      body.className = "sp-diagram-card__body";
      body.textContent = "";

      const image = document.createElement("img");
      image.className = "sp-diagram-card__image";
      image.alt = alt;
      image.draggable = false;
      image.loading = "lazy";
      image.src = url;
      image.addEventListener("error", () => {
        body.textContent = "Failed to load PlantUML diagram from the configured server.";
      });

      body.append(image);
    },
    setError: (message) => {
      renderedContent = null;
      viewButton.disabled = true;
      body.className = "sp-diagram-card__body sp-diagram-card__body--error";
      body.textContent = message;
    }
  };
}

function createButton(label: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.className = "sp-diagram-card__button";
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

function formatDiagramType(type: DiagramType): string {
  return type === "plantuml" ? "PlantUML" : "Mermaid";
}

async function openFloatingViewer(payload: ViewerPayload): Promise<void> {
  const viewerId = crypto.randomUUID();
  await chrome.storage.local.set({
    [createViewerStorageKey(viewerId)]: payload
  });

  const message: OpenViewerMessage = {
    type: "show-pic-open-viewer",
    viewerId
  };

  await chrome.runtime.sendMessage(message);
}
