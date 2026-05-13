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

const DEFAULT_MARGIN = 8;
const DEFAULT_PANEL_WIDTH = 228;
const DEFAULT_PANEL_HEIGHT = 120;
const MIN_PANEL_WIDTH = 180;
const MIN_PANEL_HEIGHT = 120;

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

function readPositiveNumber(value: number | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(min, value), max);
}
