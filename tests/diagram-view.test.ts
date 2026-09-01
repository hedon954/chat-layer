import { describe, expect, it } from "vitest";
import {
  HIDDEN_VIEW_CLASS,
  applyInlineDiagramView,
  applyInlineDiagramViewToGroup,
  readInlineDiagramView
} from "../src/content/diagram-view";

describe("inline source/diagram view", () => {
  it("shows the diagram and hides the source", () => {
    const source = { hidden: false };
    const diagram = { hidden: true };

    applyInlineDiagramView(source, diagram, "diagram");

    expect(source.hidden).toBe(true);
    expect(diagram.hidden).toBe(false);
    expect(readInlineDiagramView(source, diagram)).toBe("diagram");
  });

  it("shows the source and hides the diagram", () => {
    const source = { hidden: true };
    const diagram = { hidden: false };

    applyInlineDiagramView(source, diagram, "source");

    expect(source.hidden).toBe(false);
    expect(diagram.hidden).toBe(true);
    expect(readInlineDiagramView(source, diagram)).toBe("source");
  });

  it("keeps every source region hidden while the diagram is visible", () => {
    const sources = [{ hidden: false }, { hidden: false }];
    const diagram = { hidden: true };

    applyInlineDiagramViewToGroup(sources, diagram, "diagram");

    expect(sources.every((source) => source.hidden)).toBe(true);
    expect(diagram.hidden).toBe(false);
  });

  it("restores every source region when switching back from the diagram", () => {
    const sources = [{ hidden: true }, { hidden: true }];
    const diagram = { hidden: false };

    applyInlineDiagramViewToGroup(sources, diagram, "source");

    expect(sources.every((source) => !source.hidden)).toBe(true);
    expect(diagram.hidden).toBe(true);
  });

  it("forces the diagram display off so flex styles cannot keep it visible", () => {
    const classes = new Set<string>();
    const diagram = {
      hidden: false,
      style: { display: "flex" },
      classList: {
        toggle(name: string, force?: boolean) {
          if (force) classes.add(name);
          else classes.delete(name);
        }
      }
    };

    applyInlineDiagramView({ hidden: true }, diagram, "source");

    expect(diagram.hidden).toBe(true);
    expect(diagram.style.display).toBe("none");
    expect(classes.has(HIDDEN_VIEW_CLASS)).toBe(true);

    applyInlineDiagramView({ hidden: false }, diagram, "diagram");

    expect(diagram.hidden).toBe(false);
    expect(diagram.style.display).toBe("");
    expect(classes.has(HIDDEN_VIEW_CLASS)).toBe(false);
  });

  it("treats both visible or both hidden as an invalid split view", () => {
    expect(readInlineDiagramView({ hidden: false }, { hidden: false })).toBe("invalid");
    expect(readInlineDiagramView({ hidden: true }, { hidden: true })).toBe("invalid");
  });
});
