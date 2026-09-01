import { describe, expect, it } from "vitest";
import {
  DIAGRAM_HEADER_PADDING,
  DIAGRAM_SURFACE_BACKGROUND,
  DIAGRAM_SURFACE_FOREGROUND,
  HOST_SHOWING_DIAGRAM_CLASS,
  collectDiagramChrome,
  hostFlushStyles,
  isCodeBlockChromeClass,
  isHeaderChromeClass,
  setHostShowingDiagram
} from "../src/content/host-view";

type FakeNode = HTMLElement & {
  className: string;
  parentElement: FakeNode | null;
  children: FakeNode[];
  classList: Set<string> & { toggle(name: string, force?: boolean): boolean };
  dataset: Record<string, string | undefined>;
  styleProps: Map<string, { value: string; priority: string }>;
};

function fakeElement(className = "", children: FakeNode[] = []): FakeNode {
  const styleProps = new Map<string, { value: string; priority: string }>();
  const classList = new Set<string>() as FakeNode["classList"];
  classList.toggle = (name: string, force?: boolean) => {
    const shouldAdd = force ?? !classList.has(name);
    if (shouldAdd) classList.add(name);
    else classList.delete(name);
    return shouldAdd;
  };

  const node = {
    className,
    parentElement: null,
    children,
    classList,
    dataset: {},
    styleProps,
    contains(other: FakeNode): boolean {
      if (other === node) return true;
      return children.some((child) => child === other || child.contains(other));
    },
    querySelector(): null {
      return null;
    },
    querySelectorAll(): FakeNode[] {
      return [];
    },
    style: {
      getPropertyValue(name: string) {
        return styleProps.get(name)?.value ?? "";
      },
      getPropertyPriority(name: string) {
        return styleProps.get(name)?.priority ?? "";
      },
      setProperty(name: string, value: string, priority?: string) {
        styleProps.set(name, { value, priority: priority ?? "" });
      },
      removeProperty(name: string) {
        styleProps.delete(name);
      }
    }
  } as unknown as FakeNode;

  for (const child of children) {
    child.parentElement = node;
  }
  return node;
}

describe("host diagram coverage", () => {
  it("recognizes Gemini code-block and header class names", () => {
    expect(isCodeBlockChromeClass("formatted-code-block-internal-container")).toBe(true);
    expect(isCodeBlockChromeClass("code-block")).toBe(true);
    expect(isHeaderChromeClass("code-block-decoration header-formatted")).toBe(true);
    expect(isHeaderChromeClass("buttons")).toBe(false);
  });

  it("collects the code-block shell and the header sibling, not just the pre", () => {
    const pre = fakeElement("source-pre");
    const header = fakeElement("code-block-decoration header-formatted");
    const shell = fakeElement("formatted-code-block-internal-container", [header, pre]);

    const chrome = collectDiagramChrome(pre, pre);

    expect(chrome.shells).toContain(shell);
    expect(chrome.headers).toContain(header);
    expect(chrome.shells).not.toContain(header);
  });

  it("paints one light surface on the shell and header, then restores the original chrome", () => {
    const pre = fakeElement("source-pre");
    const title = fakeElement("title-span");
    title.style.setProperty("color", "rgb(255, 255, 255)");
    const header = fakeElement("code-block-decoration header-formatted", [title]);
    header.querySelectorAll = () => [title];
    const shell = fakeElement("formatted-code-block-internal-container", [header, pre]);
    shell.style.setProperty("background", "rgb(0, 0, 0)");
    header.style.setProperty("background", "rgb(0, 0, 0)");

    const chrome = collectDiagramChrome(pre, pre);
    setHostShowingDiagram(chrome, true);

    expect(shell.classList.has(HOST_SHOWING_DIAGRAM_CLASS)).toBe(true);
    expect(header.classList.has(HOST_SHOWING_DIAGRAM_CLASS)).toBe(true);
    expect(shell.style.getPropertyValue("background")).toBe(DIAGRAM_SURFACE_BACKGROUND);
    expect(shell.style.getPropertyPriority("background")).toBe("important");
    expect(shell.style.getPropertyValue("padding-left")).toBe("0px");
    expect(header.style.getPropertyValue("background")).toBe(DIAGRAM_SURFACE_BACKGROUND);
    expect(header.style.getPropertyValue("padding-left")).toBe(DIAGRAM_HEADER_PADDING.left);
    expect(title.style.getPropertyValue("color")).toBe(DIAGRAM_SURFACE_FOREGROUND);

    setHostShowingDiagram(chrome, false);

    expect(shell.classList.has(HOST_SHOWING_DIAGRAM_CLASS)).toBe(false);
    expect(header.classList.has(HOST_SHOWING_DIAGRAM_CLASS)).toBe(false);
    expect(shell.style.getPropertyValue("background")).toBe("rgb(0, 0, 0)");
    expect(header.style.getPropertyValue("background")).toBe("rgb(0, 0, 0)");
    expect(title.style.getPropertyValue("color")).toBe("rgb(255, 255, 255)");
    expect(header.style.getPropertyValue("padding-left")).toBe("");
  });

  it("expands the diagram into leftover host padding", () => {
    expect(hostFlushStyles({ left: 16, right: 16, bottom: 12 })).toEqual({
      marginLeft: "-16px",
      marginRight: "-16px",
      marginBottom: "-12px",
      width: "calc(100% + 32px)"
    });
    expect(hostFlushStyles({ left: 0, right: 0, bottom: 0 })).toEqual({
      marginLeft: "0px",
      marginRight: "0px",
      marginBottom: "0px",
      width: "100%"
    });
  });

  it("marks and clears the showing-diagram class on every host", () => {
    const first = fakeElement("code-block");
    const second = fakeElement("code-block");

    setHostShowingDiagram([first, second], true);
    expect(first.classList.has(HOST_SHOWING_DIAGRAM_CLASS)).toBe(true);
    expect(second.classList.has(HOST_SHOWING_DIAGRAM_CLASS)).toBe(true);

    setHostShowingDiagram([first, second], false);
    expect(first.classList.has(HOST_SHOWING_DIAGRAM_CLASS)).toBe(false);
    expect(second.classList.has(HOST_SHOWING_DIAGRAM_CLASS)).toBe(false);
  });
});
