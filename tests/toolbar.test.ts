import { describe, expect, it } from "vitest";
import { resolveActionContainer } from "../src/content/toolbar";

function element(tag: string, className = "", children: HTMLElement[] = []): HTMLElement {
  const node = {
    tagName: tag.toUpperCase(),
    className,
    parentElement: null as HTMLElement | null,
    children,
    closest(selector: string): HTMLElement | null {
      const classToken = selector.match(/class\*='([^']+)'/u)?.[1];
      let current: HTMLElement | null = node as unknown as HTMLElement;
      while (current) {
        const currentClass = (current as unknown as { className: string }).className;
        if (classToken && currentClass.includes(classToken)) {
          return current;
        }
        current = current.parentElement;
      }
      return null;
    },
    contains(other: HTMLElement): boolean {
      if (other === (node as unknown as HTMLElement)) return true;
      return children.some((child) => child === other || child.contains(other));
    },
    querySelectorAll(selector: string): HTMLElement[] {
      if (selector !== "button") return [];
      const matches: HTMLElement[] = [];
      if (tag.toLowerCase() === "button") {
        matches.push(node as unknown as HTMLElement);
      }
      for (const child of children) {
        matches.push(...child.querySelectorAll(selector));
      }
      return matches;
    }
  } as unknown as HTMLElement;

  for (const child of children) {
    Object.defineProperty(child, "parentElement", { configurable: true, value: node });
  }
  return node;
}

describe("resolveActionContainer", () => {
  it("appends to the Gemini buttons group instead of the copy icon wrapper", () => {
    const copyButton = element("button");
    const copyWrapper = element("gem-icon-button", "copy-button", [copyButton]);
    const downloadButton = element("button");
    const downloadWrapper = element("gem-icon-button", "download-button", [downloadButton]);
    const buttons = element("div", "buttons", [downloadWrapper, copyWrapper]);
    const header = element("div", "header-formatted", [buttons]);

    expect(resolveActionContainer(copyButton, header)).toBe(buttons);
  });

  it("lifts a single-button wrapper to its parent when no button group exists", () => {
    const nativeButton = element("button");
    const wrapper = element("div", "icon-wrap", [nativeButton]);
    const header = element("div", "toolbar-row", [wrapper]);

    expect(resolveActionContainer(nativeButton, header)).toBe(header);
  });
});
