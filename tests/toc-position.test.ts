import { describe, expect, it } from "vitest";
import {
  constrainTocPosition,
  constrainTocSize,
  getDefaultTocHeight,
  getDefaultTocLayout,
  resolveTocViewportLayout
} from "../src/content/toc-position";

describe("constrainTocPosition", () => {
  it("keeps a panel inside the current viewport", () => {
    expect(
      constrainTocPosition({ left: 900, top: 700 }, { width: 800, height: 600 }, { width: 228, height: 320 })
    ).toEqual({ left: 564, top: 272 });
  });

  it("falls back to a non-zero panel size when the panel is hidden", () => {
    expect(constrainTocPosition({ left: 700, top: 500 }, { width: 500, height: 400 }, { width: 0, height: 0 })).toEqual({
      left: 264,
      top: 272
    });
  });

  it("keeps the panel reachable when it is taller than the viewport", () => {
    expect(
      constrainTocPosition({ left: 100, top: 300 }, { width: 360, height: 220 }, { width: 228, height: 500 })
    ).toEqual({ left: 100, top: 8 });
  });
});

describe("constrainTocSize", () => {
  it("keeps a resized panel within useful bounds", () => {
    expect(constrainTocSize({ width: 900, height: 20 }, { width: 800, height: 600 })).toEqual({
      width: 784,
      height: 120
    });
  });

  it("supports very small viewports without returning impossible dimensions", () => {
    expect(constrainTocSize({ width: 200, height: 200 }, { width: 120, height: 100 })).toEqual({
      width: 104,
      height: 84
    });
  });
});

describe("getDefaultTocHeight", () => {
  it("uses half the viewport when content is shorter than the default height", () => {
    expect(getDefaultTocHeight(120, { width: 1280, height: 800 })).toBe(400);
  });

  it("grows with content until 80% of the viewport", () => {
    expect(getDefaultTocHeight(500, { width: 1280, height: 800 })).toBe(500);
    expect(getDefaultTocHeight(900, { width: 1280, height: 800 })).toBe(640);
  });

  it("does not force the 50% minimum while the panel is collapsed", () => {
    expect(getDefaultTocHeight(38, { width: 1280, height: 800 }, true)).toBe(38);
  });
});

describe("getDefaultTocLayout", () => {
  it("docks the panel to the right edge and vertically centers it", () => {
    expect(getDefaultTocLayout({ width: 1280, height: 800 }, 228, 120)).toEqual({
      position: { left: 1052, top: 200 },
      size: { width: 228, height: 400 }
    });
  });

  it("keeps 10% viewport gaps when the panel reaches its maximum height", () => {
    expect(getDefaultTocLayout({ width: 1280, height: 800 }, 228, 900)).toEqual({
      position: { left: 1052, top: 80 },
      size: { width: 228, height: 640 }
    });
  });

  it("shrinks the panel width to fit a narrow viewport while staying flush right", () => {
    expect(getDefaultTocLayout({ width: 160, height: 800 }, 228, 120)).toEqual({
      position: { left: 0, top: 200 },
      size: { width: 160, height: 400 }
    });
  });
});

describe("resolveTocViewportLayout", () => {
  const viewport = { width: 1280, height: 800 };
  const defaultLayout = getDefaultTocLayout(viewport, 228, 120);

  it("keeps the default right-edge dock until the user moves the panel", () => {
    const widerViewport = { width: 1600, height: 800 };
    expect(
      resolveTocViewportLayout({
        userMovedPanel: false,
        currentPosition: { left: 100, top: 80 },
        currentSize: { width: 228, height: 400 },
        viewport: widerViewport,
        defaultLayout: getDefaultTocLayout(widerViewport, 228, 120)
      })
    ).toEqual(getDefaultTocLayout(widerViewport, 228, 120));
  });

  it("preserves a user-moved position when the window grows", () => {
    expect(
      resolveTocViewportLayout({
        userMovedPanel: true,
        currentPosition: { left: 240, top: 96 },
        currentSize: { width: 228, height: 400 },
        viewport: { width: 1600, height: 800 },
        defaultLayout
      })
    ).toEqual({
      position: { left: 240, top: 96 },
      size: { width: 228, height: 400 }
    });
  });
});
