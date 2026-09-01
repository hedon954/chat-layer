export const HIDDEN_VIEW_CLASS = "sp-view-hidden";

export type InlineDiagramView = "source" | "diagram";

export type ToggleableElement = {
  hidden: boolean | string;
  classList?: {
    toggle(name: string, force?: boolean): unknown;
  };
  style?: {
    display?: string;
  };
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
  setDiagramHidden(diagram, !showDiagram);
}

function setDiagramHidden(diagram: ToggleableElement, hidden: boolean): void {
  diagram.hidden = hidden;
  diagram.classList?.toggle(HIDDEN_VIEW_CLASS, hidden);
  if (diagram.style) {
    diagram.style.display = hidden ? "none" : "";
  }
}

export function readInlineDiagramView(
  source: ToggleableElement,
  diagram: ToggleableElement
): InlineDiagramView | "invalid" {
  const sourceHidden = Boolean(source.hidden);
  const diagramHidden = Boolean(diagram.hidden);
  if (sourceHidden === diagramHidden) {
    return "invalid";
  }
  return diagramHidden ? "source" : "diagram";
}
