export const DEFAULT_DIAGRAM_MAX_HEIGHT = 280;
export const FIT_WIDTH_MAX_HEIGHT = 560;
export const DEFAULT_DIAGRAM_PADDING = 32;

export type DiagramSize = {
  width: number;
  height: number;
};

export type DiagramSizeMode = "compact" | "fit-width";

export function parseSvgViewBoxSize(viewBox: string): DiagramSize | null {
  const parts = viewBox
    .trim()
    .split(/[\s,]+/u)
    .map((part) => Number(part));
  if (parts.length !== 4) {
    return null;
  }

  const width = parts[2];
  const height = parts[3];
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }

  return { width, height };
}

export function readSvgSourceSize(svg: SVGSVGElement): DiagramSize | null {
  const viewBox = svg.viewBox?.baseVal;
  if (viewBox && viewBox.width > 0 && viewBox.height > 0) {
    return { width: viewBox.width, height: viewBox.height };
  }

  const attribute = svg.getAttribute("viewBox");
  return attribute ? parseSvgViewBoxSize(attribute) : null;
}

export function measureCompactDiagramSize(options: {
  sourceWidth: number;
  sourceHeight: number;
  maxWidth: number;
  maxHeight: number;
}): DiagramSize {
  const sourceWidth = Math.max(0, options.sourceWidth);
  const sourceHeight = Math.max(0, options.sourceHeight);
  const maxWidth = Math.max(0, options.maxWidth);
  const maxHeight = Math.max(0, options.maxHeight);

  if (sourceWidth <= 0 || sourceHeight <= 0) {
    return { width: maxWidth, height: maxHeight };
  }

  const scale = Math.min(1, maxWidth / sourceWidth, maxHeight / sourceHeight);
  return {
    width: sourceWidth * scale,
    height: sourceHeight * scale
  };
}

export function measureFitWidthDiagramSize(options: {
  sourceWidth: number;
  sourceHeight: number;
  maxWidth: number;
  maxHeight: number;
}): DiagramSize {
  const sourceWidth = Math.max(0, options.sourceWidth);
  const sourceHeight = Math.max(0, options.sourceHeight);
  const maxWidth = Math.max(0, options.maxWidth);
  const maxHeight = Math.max(0, options.maxHeight);

  if (sourceWidth <= 0 || sourceHeight <= 0) {
    return { width: maxWidth, height: Math.min(maxHeight, 160) };
  }

  const scale = Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight);
  return {
    width: sourceWidth * scale,
    height: sourceHeight * scale
  };
}

export function applyDiagramSize(
  svg: SVGSVGElement,
  viewport: HTMLElement,
  mode: DiagramSizeMode,
  attempt = 0
): void {
  const availableWidth = viewport.clientWidth || viewport.parentElement?.clientWidth || 0;
  if (availableWidth <= 0 && attempt < 4) {
    requestAnimationFrame(() => applyDiagramSize(svg, viewport, mode, attempt + 1));
    return;
  }

  const source = readSvgSourceSize(svg);
  const maxWidth = Math.max(80, availableWidth - DEFAULT_DIAGRAM_PADDING);
  const maxHeight = mode === "compact" ? DEFAULT_DIAGRAM_MAX_HEIGHT : FIT_WIDTH_MAX_HEIGHT;
  const measure = mode === "compact" ? measureCompactDiagramSize : measureFitWidthDiagramSize;
  const sized = source
    ? measure({
        sourceWidth: source.width,
        sourceHeight: source.height,
        maxWidth,
        maxHeight
      })
    : { width: maxWidth, height: Math.min(maxHeight, 160) };

  svg.style.width = `${sized.width}px`;
  svg.style.height = `${sized.height}px`;
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  viewport.style.height = `${sized.height + DEFAULT_DIAGRAM_PADDING}px`;
}

export function applyCompactDiagramSize(
  svg: SVGSVGElement,
  viewport: HTMLElement,
  attempt = 0
): void {
  applyDiagramSize(svg, viewport, "compact", attempt);
}
