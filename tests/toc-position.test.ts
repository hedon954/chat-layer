import { describe, expect, it } from "vitest";
import { constrainTocPosition, constrainTocSize } from "../src/content/toc-position";

describe("constrainTocPosition", () => {
  it("keeps a panel inside the current viewport", () => {
    expect(
      constrainTocPosition({ left: 900, top: 700 }, { width: 800, height: 600 }, { width: 360, height: 320 })
    ).toEqual({ left: 432, top: 272 });
  });

  it("falls back to a non-zero panel size when the panel is hidden", () => {
    expect(constrainTocPosition({ left: 700, top: 500 }, { width: 500, height: 400 }, { width: 0, height: 0 })).toEqual({
      left: 132,
      top: 272
    });
  });

  it("keeps the panel reachable when it is taller than the viewport", () => {
    expect(
      constrainTocPosition({ left: 100, top: 300 }, { width: 360, height: 220 }, { width: 360, height: 500 })
    ).toEqual({ left: 8, top: 8 });
  });
});

describe("constrainTocSize", () => {
  it("keeps a resized panel within useful bounds", () => {
    expect(constrainTocSize({ width: 900, height: 20 }, { width: 800, height: 600 })).toEqual({
      width: 784,
      height: 120
    });
  });

  it("keeps resized panels wide enough for readable long titles", () => {
    expect(constrainTocSize({ width: 120, height: 260 }, { width: 800, height: 600 })).toEqual({
      width: 240,
      height: 260
    });
  });

  it("supports very small viewports without returning impossible dimensions", () => {
    expect(constrainTocSize({ width: 200, height: 200 }, { width: 120, height: 100 })).toEqual({
      width: 104,
      height: 84
    });
  });
});
