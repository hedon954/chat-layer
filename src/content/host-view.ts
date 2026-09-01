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
