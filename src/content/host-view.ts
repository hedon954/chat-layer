export const HOST_SHOWING_DIAGRAM_CLASS = "sp-host-showing-diagram";

export const DIAGRAM_SURFACE_BACKGROUND = "#ffffff";
export const DIAGRAM_SURFACE_FOREGROUND = "#0f172a";
export const DIAGRAM_HEADER_PADDING = {
  top: "10px",
  right: "12px",
  bottom: "10px",
  left: "16px"
} as const;

export type DiagramHostRole = "shell" | "header";

export type DiagramHostChrome = {
  shells: HTMLElement[];
  headers: HTMLElement[];
};

type SavedProperty = {
  value: string;
  priority: string;
};

const savedInlineStyles = new WeakMap<HTMLElement, Map<string, SavedProperty>>();

const CODE_CHROME_CLASS = /(?:^|[^-])(?:code-block|codeBlock|formatted-code)/u;
const HEADER_CHROME_CLASS = /header|code-block-decoration/iu;

export function isCodeBlockChromeClass(className: string): boolean {
  return CODE_CHROME_CLASS.test(className);
}

export function isHeaderChromeClass(className: string): boolean {
  return HEADER_CHROME_CLASS.test(className);
}

export function hostFlushStyles(padding: { left: number; right: number; bottom: number }): Record<string, string> {
  const left = Math.max(0, padding.left);
  const right = Math.max(0, padding.right);
  const bottom = Math.max(0, padding.bottom);
  return {
    marginLeft: left > 0 ? `-${left}px` : "0px",
    marginRight: right > 0 ? `-${right}px` : "0px",
    marginBottom: bottom > 0 ? `-${bottom}px` : "0px",
    width: left > 0 || right > 0 ? `calc(100% + ${left + right}px)` : "100%"
  };
}

export function collectDiagramChrome(sourceContent: HTMLElement, sourceBlock: HTMLElement): DiagramHostChrome {
  const shells = new Set<HTMLElement>([sourceBlock]);
  const headers = new Set<HTMLElement>();

  const parent = sourceContent.parentElement;
  if (parent) {
    shells.add(parent);
  }

  let current: HTMLElement | null = parent;
  for (let depth = 0; depth < 6 && current; depth += 1) {
    if (isCodeBlockChromeClass(readClassName(current))) {
      shells.add(current);
    }
    collectHeaderSiblings(current, sourceContent, headers);
    current = current.parentElement;
  }

  for (const header of headers) {
    shells.delete(header);
  }

  return {
    shells: [...shells],
    headers: [...headers]
  };
}

export function collectDiagramHosts(sourceContent: HTMLElement, sourceBlock: HTMLElement): HTMLElement[] {
  const chrome = collectDiagramChrome(sourceContent, sourceBlock);
  return [...new Set([...chrome.shells, ...chrome.headers])];
}

function isHostChrome(hosts: readonly HTMLElement[] | DiagramHostChrome): hosts is DiagramHostChrome {
  return !Array.isArray(hosts);
}

export function setHostShowingDiagram(
  hosts: readonly HTMLElement[] | DiagramHostChrome,
  showing: boolean,
  sourceContent?: HTMLElement
): void {
  const chrome: DiagramHostChrome = isHostChrome(hosts)
    ? hosts
    : { shells: [...hosts], headers: sourceContent ? collectHeaderSiblingsInto(hosts, sourceContent) : [] };

  for (const shell of chrome.shells) {
    toggleHost(shell, showing);
    paintSurface(shell, "shell", showing);
  }
  for (const header of chrome.headers) {
    toggleHost(header, showing);
    paintSurface(header, "header", showing);
    paintHeaderForeground(header, showing);
  }
}

export function flushDiagramIntoHost(diagram: HTMLElement, host: HTMLElement): void {
  const style = getComputedStyle(host);
  const flush = hostFlushStyles({
    left: Number.parseFloat(style.paddingLeft) || 0,
    right: Number.parseFloat(style.paddingRight) || 0,
    bottom: Number.parseFloat(style.paddingBottom) || 0
  });
  diagram.style.marginLeft = flush.marginLeft;
  diagram.style.marginRight = flush.marginRight;
  diagram.style.marginBottom = flush.marginBottom;
  diagram.style.width = flush.width;
}

export function resetDiagramHostFlush(diagram: HTMLElement): void {
  diagram.style.marginLeft = "";
  diagram.style.marginRight = "";
  diagram.style.marginBottom = "";
  diagram.style.width = "";
}

function toggleHost(host: HTMLElement, showing: boolean): void {
  host.classList.toggle(HOST_SHOWING_DIAGRAM_CLASS, showing);
}

function paintSurface(host: HTMLElement, role: DiagramHostRole, showing: boolean): void {
  if (!showing) {
    restoreInlineStyles(host);
    delete host.dataset.spSurface;
    return;
  }

  host.dataset.spSurface = role;
  if (role === "header") {
    setInlineStyles(host, {
      background: DIAGRAM_SURFACE_BACKGROUND,
      "background-color": DIAGRAM_SURFACE_BACKGROUND,
      "background-image": "none",
      color: DIAGRAM_SURFACE_FOREGROUND,
      "padding-top": DIAGRAM_HEADER_PADDING.top,
      "padding-right": DIAGRAM_HEADER_PADDING.right,
      "padding-bottom": DIAGRAM_HEADER_PADDING.bottom,
      "padding-left": DIAGRAM_HEADER_PADDING.left,
      border: "0",
      "box-shadow": "none"
    });
    return;
  }

  setInlineStyles(host, {
    background: DIAGRAM_SURFACE_BACKGROUND,
    "background-color": DIAGRAM_SURFACE_BACKGROUND,
    "background-image": "none",
    color: DIAGRAM_SURFACE_FOREGROUND,
    "padding-right": "0px",
    "padding-bottom": "0px",
    "padding-left": "0px",
    "border-color": DIAGRAM_SURFACE_BACKGROUND,
    "box-shadow": "none"
  });
}

function paintHeaderForeground(header: HTMLElement, showing: boolean): void {
  const nodes = Array.from(
    header.querySelectorAll<HTMLElement>("span, button, .mat-icon, mat-icon, [class*='icon'], svg")
  );
  for (const node of nodes) {
    if (!showing) {
      restoreInlineStyles(node);
      continue;
    }
    setInlineStyles(node, {
      color: DIAGRAM_SURFACE_FOREGROUND,
      fill: "currentColor"
    });
  }
}

function collectHeaderSiblings(
  parent: HTMLElement,
  sourceContent: HTMLElement,
  headers: Set<HTMLElement>
): void {
  for (const sibling of Array.from(parent.children)) {
    if (!isPaintTarget(sibling) || sibling === sourceContent || sibling.contains(sourceContent)) {
      continue;
    }
    if (isHeaderChromeClass(readClassName(sibling)) || looksLikeToolbarRow(sibling)) {
      headers.add(sibling);
    }
  }
}

function isPaintTarget(node: Element): node is HTMLElement {
  return "style" in node && "classList" in node && "dataset" in node;
}

function collectHeaderSiblingsInto(hosts: readonly HTMLElement[], sourceContent: HTMLElement): HTMLElement[] {
  const headers = new Set<HTMLElement>();
  for (const host of hosts) {
    collectHeaderSiblings(host, sourceContent, headers);
    if (isHeaderChromeClass(readClassName(host))) {
      headers.add(host);
    }
  }
  return [...headers];
}

function looksLikeToolbarRow(element: HTMLElement): boolean {
  if (element.querySelector("pre, code, .sp-inline-diagram")) {
    return false;
  }
  return Boolean(element.querySelector("[class*='buttons'], .copy-button, gem-icon-button, [class*='icon-button']"));
}

function readClassName(element: { className?: unknown }): string {
  return typeof element.className === "string" ? element.className : "";
}

function setInlineStyles(element: HTMLElement, properties: Record<string, string>): void {
  let bag = savedInlineStyles.get(element);
  if (!bag) {
    bag = new Map();
    savedInlineStyles.set(element, bag);
    for (const name of Object.keys(properties)) {
      bag.set(name, {
        value: element.style.getPropertyValue(name),
        priority: element.style.getPropertyPriority(name)
      });
    }
  }

  for (const [name, value] of Object.entries(properties)) {
    element.style.setProperty(name, value, "important");
  }
}

function restoreInlineStyles(element: HTMLElement): void {
  const bag = savedInlineStyles.get(element);
  if (!bag) {
    return;
  }

  for (const [name, previous] of bag) {
    if (previous.value) {
      element.style.setProperty(name, previous.value, previous.priority || undefined);
    } else {
      element.style.removeProperty(name);
    }
  }
  savedInlineStyles.delete(element);
}
