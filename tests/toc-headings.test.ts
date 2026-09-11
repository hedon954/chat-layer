import { describe, expect, it } from "vitest";
import { mergeChatGptHeadings } from "../src/content/toc-chatgpt-headings";
import { mergeGeminiHeadings } from "../src/content/toc-gemini-headings";

function heading(text: string, level = 2, element = { isConnected: true }) {
  return { text, level, element };
}

describe.each([
  ["ChatGPT", mergeChatGptHeadings],
  ["Gemini", mergeGeminiHeadings]
] as const)("%s heading cache", (_platform, merge) => {
  it("inserts a newly mounted parent before its previously cached children", () => {
    const child = heading("Child", 3);
    const sibling = heading("Next section", 2);
    const parent = heading("Parent", 2);

    expect(merge([child, sibling], [parent, child, sibling]).map((h) => h.text))
      .toEqual(["Parent", "Child", "Next section"]);
  });

  it("updates a heading level without leaving a duplicate at the old level", () => {
    const old = heading("Section", 3);
    const next = heading("Section", 2);
    old.element.isConnected = false;

    const result = merge([old], [next]);
    expect(result).toEqual([next]);
    expect(result[0]).toBe(old);
    expect(old.element).toBe(next.element);
  });

  it("updates streaming text on the same element in its original position", () => {
    const old = heading("Partial");
    const sibling = heading("Next section");
    const next = heading("Partial heading completed", 2, old.element);

    expect(merge([old, sibling], [next, sibling])).toEqual([next, sibling]);
  });

  it("preserves repeated headings as separate navigation targets", () => {
    const first = heading("Summary");
    const second = heading("Summary");
    const result = merge([], [first, second]);
    const mounted = [heading("Summary"), heading("Summary")];

    const updated = merge(result, mounted);
    expect(updated).toHaveLength(2);
    expect(updated[0].element).toBe(mounted[0].element);
    expect(updated[1].element).toBe(mounted[1].element);
  });

  it("follows DOM order when existing headings are moved", () => {
    const parent = heading("Parent");
    const first = heading("First", 3);
    const second = heading("Second", 3);

    expect(merge([parent, first, second], [parent, second, first]))
      .toEqual([parent, second, first]);
  });

  it("retains unmounted headings around a partial DOM snapshot", () => {
    const parent = heading("Parent", 2, { isConnected: false });
    const child = heading("Child", 3);
    const tail = heading("Later section", 2, { isConnected: false });
    const inserted = heading("Earlier child", 3);
    const result = merge([parent, child, tail], [inserted, child]);

    expect(result.map((h) => h.text)).toEqual(["Parent", "Earlier child", "Child", "Later section"]);
    expect(result[0].element).toBeNull();
    expect(result[3].element).toBeNull();
  });

  it("keeps cached headings when a reply is fully virtualized", () => {
    const old = heading("Section", 2, { isConnected: false });
    expect(merge([old], [])).toEqual([{ text: "Section", level: 2, element: null }]);
  });

  it("matches element identity before equal text from another heading", () => {
    const first = heading("Summary");
    const second = heading("Summary");
    const newFirst = heading("Summary");
    const result = merge([first, second], [newFirst, second]);

    expect(result[0]).toBe(first);
    expect(result[1]).toBe(second);
    expect(first.element).toBe(newFirst.element);
  });

  it("is stable across repeated scans", () => {
    const headings = [heading("Parent"), heading("Child", 3), heading("Next section")];
    let result = merge([], headings);
    for (let i = 0; i < 5; i++) result = merge(result, headings);
    expect(result).toEqual(headings);
  });
});
