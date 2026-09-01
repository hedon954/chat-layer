export const HOST_SHOWING_DIAGRAM_CLASS = "sp-host-showing-diagram";

export function collectDiagramHosts(sourceContent: HTMLElement, sourceBlock: HTMLElement): HTMLElement[] {
  const hosts = new Set<HTMLElement>([sourceBlock]);
  const parent = sourceContent.parentElement;
  if (parent) {
    hosts.add(parent);
  }

  const container = sourceContent.closest<HTMLElement>("[class*='code-block'], [class*='codeBlock']");
  if (container) {
    hosts.add(container);
  }

  return [...hosts];
}

export function setHostShowingDiagram(hosts: readonly HTMLElement[], showing: boolean): void {
  for (const host of hosts) {
    host.classList.toggle(HOST_SHOWING_DIAGRAM_CLASS, showing);
  }
}

export function flushDiagramIntoHost(diagram: HTMLElement, host: HTMLElement): void {
  const style = getComputedStyle(host);
  const bottom = Number.parseFloat(style.paddingBottom) || 0;
  diagram.style.marginLeft = "0px";
  diagram.style.marginRight = "0px";
  diagram.style.marginBottom = bottom > 0 ? `-${bottom}px` : "0px";
  diagram.style.width = "";
}

export function resetDiagramHostFlush(diagram: HTMLElement): void {
  diagram.style.marginLeft = "";
  diagram.style.marginRight = "";
  diagram.style.marginBottom = "";
  diagram.style.width = "";
}
