export type TocPosition = {
  left: number;
  top: number;
};

export type TocSize = {
  width: number;
  height: number;
};

export type TocViewport = {
  width: number;
  height: number;
};

export type TocLayout = {
  position: TocPosition;
  size: TocSize;
};

const DEFAULT_MARGIN = 8;
const DEFAULT_PANEL_WIDTH = 228;
const DEFAULT_PANEL_HEIGHT = 120;
const MIN_PANEL_WIDTH = 180;
const MIN_PANEL_HEIGHT = 120;
const DEFAULT_HEIGHT_RATIO = 0.5;
const MAX_HEIGHT_RATIO = 0.8;
const DEFAULT_EDGE_MARGIN = 0;

export function constrainTocPosition(
  position: TocPosition,
  viewport: TocViewport,
  size?: Partial<TocSize>,
  margin = DEFAULT_MARGIN
): TocPosition {
  const width = readPositiveNumber(size?.width) ?? Math.min(DEFAULT_PANEL_WIDTH, viewport.width - margin * 2);
  const height = readPositiveNumber(size?.height) ?? Math.min(DEFAULT_PANEL_HEIGHT, viewport.height - margin * 2);
  const maxLeft = Math.max(margin, viewport.width - Math.max(0, width) - margin);
  const maxTop = Math.max(margin, viewport.height - Math.max(0, height) - margin);

  return {
    left: clamp(position.left, margin, maxLeft),
    top: clamp(position.top, margin, maxTop)
  };
}

export function constrainTocSize(size: TocSize, viewport: TocViewport, margin = DEFAULT_MARGIN): TocSize {
  const maxWidth = Math.max(64, viewport.width - margin * 2);
  const maxHeight = Math.max(64, viewport.height - margin * 2);
  const minWidth = Math.min(MIN_PANEL_WIDTH, maxWidth);
  const minHeight = Math.min(MIN_PANEL_HEIGHT, maxHeight);

  return {
    width: clamp(size.width, minWidth, maxWidth),
    height: clamp(size.height, minHeight, maxHeight)
  };
}

export function getDefaultTocHeight(contentHeight: number, viewport: TocViewport, collapsed = false): number {
  const maxHeight = Math.max(0, viewport.height * MAX_HEIGHT_RATIO);
  if (collapsed) {
    return clamp(Math.max(0, contentHeight), 0, maxHeight);
  }

  const minHeight = Math.max(0, viewport.height * DEFAULT_HEIGHT_RATIO);
  const boundedMin = Math.min(minHeight, maxHeight);
  if (!Number.isFinite(contentHeight) || contentHeight <= 0) {
    return boundedMin;
  }
  return clamp(contentHeight, boundedMin, maxHeight);
}

export function getDefaultTocLayout(
  viewport: TocViewport,
  panelWidth: number,
  contentHeight: number,
  collapsed = false
): TocLayout {
  const width = clamp(readPositiveNumber(panelWidth) ?? DEFAULT_PANEL_WIDTH, 0, Math.max(0, viewport.width));
  const height = getDefaultTocHeight(contentHeight, viewport, collapsed);
  const size = { width, height };
  const position = constrainTocPosition(
    {
      left: viewport.width - width - DEFAULT_EDGE_MARGIN,
      top: (viewport.height - height) / 2
    },
    viewport,
    size,
    DEFAULT_EDGE_MARGIN
  );
  return { position, size };
}

function readPositiveNumber(value: number | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(min, value), max);
}
