export type InlineDiagramView = "source" | "diagram";

export type ToggleableElement = {
  hidden: boolean;
};

export function applyInlineDiagramView(
  source: ToggleableElement,
  diagram: ToggleableElement,
  view: InlineDiagramView
): void {
  applyInlineDiagramViewToGroup([source], diagram, view);
}

export function applyInlineDiagramViewToGroup(
  sourceElements: readonly ToggleableElement[],
  diagram: ToggleableElement,
  view: InlineDiagramView
): void {
  const showDiagram = view === "diagram";
  for (const source of sourceElements) {
    source.hidden = showDiagram;
  }
  diagram.hidden = !showDiagram;
}

export function readInlineDiagramView(
  source: ToggleableElement,
  diagram: ToggleableElement
): InlineDiagramView | "invalid" {
  if (source.hidden === diagram.hidden) {
    return "invalid";
  }
  return diagram.hidden ? "source" : "diagram";
}
