export function resolveActionContainer(lastButton: HTMLElement, header: HTMLElement): HTMLElement {
  const group = lastButton.closest<HTMLElement>(
    "[class*='buttons'], [class*='actions'], [class*='toolbar']"
  );
  if (group && header.contains(group)) {
    return group;
  }

  const parent = lastButton.parentElement ?? header;
  if (parent !== header && parent.querySelectorAll("button").length <= 1 && parent.parentElement) {
    return parent.parentElement;
  }

  return parent;
}
