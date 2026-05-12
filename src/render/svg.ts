export async function fetchSanitizedSvg(url: string): Promise<string> {
  const response = await fetch(url, {
    credentials: "omit",
    cache: "force-cache"
  });

  if (!response.ok) {
    throw new Error(`SVG request failed with status ${response.status}.`);
  }

  const svg = await response.text();
  return sanitizeSvg(svg);
}

export async function sanitizeSvgText(svg: string): Promise<string> {
  return sanitizeSvg(svg);
}

export function sanitizeSvg(svg: string): string {
  const document = new DOMParser().parseFromString(svg, "image/svg+xml");
  if (document.querySelector("parsererror")) {
    throw new Error("PlantUML server returned invalid SVG.");
  }

  document.querySelectorAll("script, foreignObject, iframe, object, embed").forEach((element) => element.remove());

  for (const styleElement of Array.from(document.querySelectorAll("style"))) {
    styleElement.textContent = removeExternalCssReferences(styleElement.textContent ?? "");
  }

  for (const element of Array.from(document.querySelectorAll("*"))) {
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim().toLowerCase();

      if (name.startsWith("on") || value.startsWith("javascript:")) {
        element.removeAttribute(attribute.name);
      }
    }
  }

  const root = document.documentElement;
  if (root.tagName.toLowerCase() !== "svg") {
    throw new Error("PlantUML server did not return an SVG document.");
  }

  ensureViewBox(root);
  stripIntrinsicSizing(root);

  return new XMLSerializer().serializeToString(root);
}

function ensureViewBox(root: Element): void {
  if (root.hasAttribute("viewBox")) {
    return;
  }
  const width = parseFloat(root.getAttribute("width") ?? "");
  const height = parseFloat(root.getAttribute("height") ?? "");
  if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
    root.setAttribute("viewBox", `0 0 ${width} ${height}`);
  }
}

function stripIntrinsicSizing(root: Element): void {
  root.removeAttribute("width");
  root.removeAttribute("height");
  const inlineStyle = root.getAttribute("style");
  if (inlineStyle) {
    const cleaned = inlineStyle
      .split(";")
      .map((rule) => rule.trim())
      .filter((rule) => rule.length > 0 && !/^(width|height|max-width|max-height)\s*:/iu.test(rule))
      .join("; ");
    if (cleaned.length > 0) {
      root.setAttribute("style", cleaned);
    } else {
      root.removeAttribute("style");
    }
  }
}

function removeExternalCssReferences(css: string): string {
  return css
    .replace(/@import[^;]+;/giu, "")
    .replace(/url\(\s*(['"]?)https?:\/\/.+?\1\s*\)/giu, "none");
}
