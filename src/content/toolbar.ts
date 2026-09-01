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

export function readToolbarReferenceMetrics(toolbar: HTMLElement): ToolbarMetrics | null {
  const host = toolbar.querySelector<HTMLElement>("gem-icon-button, [class*='icon-button']");
  const nativeButton = toolbar.querySelector<HTMLElement>("button:not(.sp-code-render-button)");
  const height = (host && readableHeight(host)) || (nativeButton && readableHeight(nativeButton));
  if (!height) {
    return null;
  }

  const colorSource = nativeButton ?? host;
  return {
    height,
    color: colorSource ? getComputedStyle(colorSource).color : "inherit"
  };
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

  const metrics = readToolbarReferenceMetrics(toolbar);
  if (!metrics) {
    return;
  }

  const styles = toolbarButtonInlineStyles(metrics);
  for (const [property, value] of Object.entries(styles)) {
    button.style.setProperty(property.replace(/[A-Z]/gu, (letter) => `-${letter.toLowerCase()}`), value);
  }
}
