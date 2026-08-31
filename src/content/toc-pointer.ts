export type TrackPointerGestureOptions = {
  handle: HTMLElement;
  pointerId: number;
  onMove: (event: PointerEvent) => void;
  onEnd: () => void;
};

type PointerGestureEvent = {
  type: string;
  buttons: number;
  pointerId: number;
};

export function pointerEventEndsGesture(event: PointerGestureEvent, activePointerId: number): boolean {
  if (event.pointerId !== activePointerId) return false;
  if (event.type === "pointerup" || event.type === "pointercancel" || event.type === "lostpointercapture") {
    return true;
  }
  return event.type === "pointermove" && event.buttons === 0;
}

export function trackPointerGesture(options: TrackPointerGestureOptions): { stop: () => void } {
  const { handle, pointerId, onMove, onEnd } = options;
  let ended = false;
  let lastMoveEvent: PointerEvent | undefined;

  const stop = (): void => {
    if (ended) return;
    ended = true;
    handle.removeEventListener("pointermove", handleMove);
    handle.removeEventListener("pointerup", handleEnd);
    handle.removeEventListener("pointercancel", handleEnd);
    handle.removeEventListener("lostpointercapture", handleEnd);
    window.removeEventListener("pointermove", handleMove, true);
    window.removeEventListener("pointerup", handleEnd, true);
    window.removeEventListener("pointercancel", handleEnd, true);
    try {
      if (handle.hasPointerCapture(pointerId)) {
        handle.releasePointerCapture(pointerId);
      }
    } catch {
      // The browser may already have released capture.
    }
    onEnd();
  };

  const handleMove = (event: PointerEvent): void => {
    if (ended || event === lastMoveEvent || event.pointerId !== pointerId) return;
    lastMoveEvent = event;
    if (pointerEventEndsGesture(event, pointerId)) {
      stop();
      return;
    }
    onMove(event);
  };

  const handleEnd = (event: PointerEvent): void => {
    if (!pointerEventEndsGesture(event, pointerId)) return;
    stop();
  };

  handle.addEventListener("pointermove", handleMove);
  handle.addEventListener("pointerup", handleEnd);
  handle.addEventListener("pointercancel", handleEnd);
  handle.addEventListener("lostpointercapture", handleEnd);
  window.addEventListener("pointermove", handleMove, true);
  window.addEventListener("pointerup", handleEnd, true);
  window.addEventListener("pointercancel", handleEnd, true);

  try {
    handle.setPointerCapture(pointerId);
  } catch {
    // Capture is best-effort; window capture-phase listeners still end the gesture.
  }

  return { stop };
}
