export type ToolbarMetrics = {
  height: string;
  color: string;
};

export function resolveActionContainer(lastButton: HTMLElement, header: HTMLElement): HTMLElement {
  const group = lastButton.closest<HTMLElement>(
    "[class*='buttons'], [class*='actions'], [class*='toolbar']"
  );
  if (group && header.contains(group)) {
    return group;
  }

  const parent = lastButton.parentElement ?? header;
  if (parent !== header && parent.querySelectorAll("button").length <= 1 && parent.parentElement) {
    return parent.parentElement;
  }

  return parent;
}

function readableHeight(element: HTMLElement): string | null {
  const height = getComputedStyle(element).height;
  const pixels = Number.parseFloat(height);
  if (!Number.isFinite(pixels) || pixels < 16) {
    return null;
  }
  return height;
}

function readableColor(element: HTMLElement | null): string | null {
  if (!element) {
    return null;
  }
  const color = getComputedStyle(element).color;
  if (!color || color === "rgba(0, 0, 0, 0)" || color === "transparent") {
    return null;
  }
  return color;
}

export function readToolbarLabelColor(toolbar: HTMLElement): string {
  const header = toolbar.closest<HTMLElement>("[class*='header']") ?? toolbar.parentElement;
  const title = header?.querySelector<HTMLElement>(":scope > span");
  const icon = toolbar.querySelector<HTMLElement>(".mat-icon, mat-icon, [data-mat-icon-name]");
  return readableColor(title ?? null) ?? readableColor(icon) ?? "inherit";
}

export function readToolbarReferenceMetrics(toolbar: HTMLElement): ToolbarMetrics | null {
  const host = toolbar.querySelector<HTMLElement>("gem-icon-button, [class*='icon-button']");
  const nativeButton = toolbar.querySelector<HTMLElement>("button:not(.sp-code-render-button)");
  const height = (host && readableHeight(host)) || (nativeButton && readableHeight(nativeButton));
  if (!height) {
    return null;
  }

  return {
    height,
    color: readToolbarLabelColor(toolbar)
  };
}

export const HEADER_TITLE_INSET = "10px";

export function insetHeaderTitle(toolbar: HTMLElement): void {
  const header = toolbar.closest<HTMLElement>("[class*='header']") ?? toolbar.parentElement;
  const title = header?.querySelector<HTMLElement>(":scope > span");
  if (!title) {
    return;
  }
  title.style.setProperty("padding-left", HEADER_TITLE_INSET);
}

export function toolbarButtonInlineStyles(metrics: ToolbarMetrics): Record<string, string> {
  return {
    height: metrics.height,
    minHeight: metrics.height,
    maxHeight: metrics.height,
    margin: "0",
    paddingTop: "0",
    paddingBottom: "0",
    paddingLeft: "8px",
    paddingRight: "8px",
    lineHeight: "1",
    color: metrics.color,
    background: "transparent",
    border: "0",
    boxShadow: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center"
  };
}

export function alignToolbarButton(button: HTMLElement, toolbar: HTMLElement): void {
  toolbar.classList.add("sp-native-toolbar");
  toolbar.style.setProperty("display", "flex", "important");
  toolbar.style.setProperty("align-items", "center", "important");
  insetHeaderTitle(toolbar);

  const metrics = readToolbarReferenceMetrics(toolbar);
  if (!metrics) {
    return;
  }

  const styles = toolbarButtonInlineStyles(metrics);
  for (const [property, value] of Object.entries(styles)) {
    const cssName = property.replace(/[A-Z]/gu, (letter) => `-${letter.toLowerCase()}`);
    button.style.setProperty(cssName, value, cssName === "color" ? "important" : undefined);
  }
}
