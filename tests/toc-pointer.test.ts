import { describe, expect, it } from "vitest";
import { pointerEventEndsGesture } from "../src/content/toc-pointer";

describe("pointerEventEndsGesture", () => {
  it("ends on pointerup for the active pointer", () => {
    expect(pointerEventEndsGesture({ type: "pointerup", buttons: 0, pointerId: 1 }, 1)).toBe(true);
  });

  it("ends on pointercancel and lostpointercapture", () => {
    expect(pointerEventEndsGesture({ type: "pointercancel", buttons: 0, pointerId: 7 }, 7)).toBe(true);
    expect(pointerEventEndsGesture({ type: "pointercancel", buttons: 1, pointerId: 7 }, 7)).toBe(true);
    expect(pointerEventEndsGesture({ type: "lostpointercapture", buttons: 1, pointerId: 7 }, 7)).toBe(true);
  });

  it("ends a stuck drag when pointermove arrives with no buttons pressed", () => {
    expect(pointerEventEndsGesture({ type: "pointermove", buttons: 0, pointerId: 1 }, 1)).toBe(true);
  });

  it("keeps dragging while the active pointer still has buttons down", () => {
    expect(pointerEventEndsGesture({ type: "pointermove", buttons: 1, pointerId: 1 }, 1)).toBe(false);
  });

  it("ignores events from a different pointer", () => {
    expect(pointerEventEndsGesture({ type: "pointerup", buttons: 0, pointerId: 2 }, 1)).toBe(false);
    expect(pointerEventEndsGesture({ type: "pointermove", buttons: 0, pointerId: 2 }, 1)).toBe(false);
    expect(pointerEventEndsGesture({ type: "lostpointercapture", buttons: 0, pointerId: 2 }, 1)).toBe(false);
  });
});
