import { describe, expect, it } from "vitest";
import {
  DEFAULT_DIAGRAM_MAX_HEIGHT,
  measureCompactDiagramSize,
  parseSvgViewBoxSize
} from "../src/content/diagram-size";

describe("compact diagram sizing", () => {
  it("parses a standard viewBox", () => {
    expect(parseSvgViewBoxSize("0 0 800 600")).toEqual({ width: 800, height: 600 });
  });

  it("parses a comma-separated viewBox", () => {
    expect(parseSvgViewBoxSize("0,0,400,200")).toEqual({ width: 400, height: 200 });
  });

  it("rejects an invalid viewBox", () => {
    expect(parseSvgViewBoxSize("0 0 800")).toBeNull();
    expect(parseSvgViewBoxSize("0 0 -10 20")).toBeNull();
  });

  it("keeps a small diagram at its natural size", () => {
    expect(
      measureCompactDiagramSize({
        sourceWidth: 220,
        sourceHeight: 160,
        maxWidth: 640,
        maxHeight: DEFAULT_DIAGRAM_MAX_HEIGHT
      })
    ).toEqual({ width: 220, height: 160 });
  });

  it("downscales a tall diagram to the compact max height", () => {
    expect(
      measureCompactDiagramSize({
        sourceWidth: 800,
        sourceHeight: 600,
        maxWidth: 700,
        maxHeight: DEFAULT_DIAGRAM_MAX_HEIGHT
      })
    ).toEqual({
      width: 800 * (DEFAULT_DIAGRAM_MAX_HEIGHT / 600),
      height: DEFAULT_DIAGRAM_MAX_HEIGHT
    });
  });

  it("downscales a wide diagram to the available width", () => {
    expect(
      measureCompactDiagramSize({
        sourceWidth: 1200,
        sourceHeight: 200,
        maxWidth: 600,
        maxHeight: DEFAULT_DIAGRAM_MAX_HEIGHT
      })
    ).toEqual({ width: 600, height: 100 });
  });
});
