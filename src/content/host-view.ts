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
  const left = Number.parseFloat(style.paddingLeft) || 0;
  const right = Number.parseFloat(style.paddingRight) || 0;
  const bottom = Number.parseFloat(style.paddingBottom) || 0;
  diagram.style.marginLeft = left > 0 ? `-${left}px` : "0px";
  diagram.style.marginRight = right > 0 ? `-${right}px` : "0px";
  diagram.style.marginBottom = bottom > 0 ? `-${bottom}px` : "0px";
  diagram.style.width = left > 0 || right > 0 ? `calc(100% + ${left + right}px)` : "";
}

export function resetDiagramHostFlush(diagram: HTMLElement): void {
  diagram.style.marginLeft = "";
  diagram.style.marginRight = "";
  diagram.style.marginBottom = "";
  diagram.style.width = "";
}
