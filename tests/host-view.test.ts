import { describe, expect, it } from "vitest";
import { HOST_SHOWING_DIAGRAM_CLASS, setHostShowingDiagram } from "../src/content/host-view";

describe("host diagram coverage", () => {
  it("marks and clears the showing-diagram class on every host", () => {
    const first = { classList: new Set<string>() };
    const second = { classList: new Set<string>() };
    const hosts = [
      {
        classList: {
          toggle(name: string, force?: boolean) {
            if (force) first.classList.add(name);
            else first.classList.delete(name);
          }
        }
      },
      {
        classList: {
          toggle(name: string, force?: boolean) {
            if (force) second.classList.add(name);
            else second.classList.delete(name);
          }
        }
      }
    ] as unknown as HTMLElement[];

    setHostShowingDiagram(hosts, true);
    expect(first.classList.has(HOST_SHOWING_DIAGRAM_CLASS)).toBe(true);
    expect(second.classList.has(HOST_SHOWING_DIAGRAM_CLASS)).toBe(true);

    setHostShowingDiagram(hosts, false);
    expect(first.classList.has(HOST_SHOWING_DIAGRAM_CLASS)).toBe(false);
    expect(second.classList.has(HOST_SHOWING_DIAGRAM_CLASS)).toBe(false);
  });
});
