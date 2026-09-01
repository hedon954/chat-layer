export const HOST_SHOWING_DIAGRAM_CLASS = "sp-host-showing-diagram";

export function collectDiagramHosts(sourceContent: HTMLElement, sourceBlock: HTMLElement): HTMLElement[] {
  const hosts = new Set<HTMLElement>([sourceBlock]);
  let current: HTMLElement | null = sourceContent.parentElement;
  for (let depth = 0; depth < 5 && current; depth += 1) {
    const className = typeof current.className === "string" ? current.className : "";
    if (/(?:^|[^-])(?:code-block|codeBlock|formatted-code)/u.test(className)) {
      hosts.add(current);
    }
    current = current.parentElement;
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
