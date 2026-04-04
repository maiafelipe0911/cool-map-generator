/**
 * mouse.ts
 * --------
 * Captures mouse drag events on the canvas and accumulates pixel deltas
 * between frames. The game loop reads and resets deltas once per frame
 * via consumeDelta().
 *
 * This module is pure DOM event wiring — no logic, no rendering.
 */

export interface DragState {
  isDragging: boolean;
  lastX: number;
  lastY: number;
  deltaX: number;
  deltaY: number;
}

/** Create a fresh drag state with no accumulated movement. */
export function createDragState(): DragState {
  return { isDragging: false, lastX: 0, lastY: 0, deltaX: 0, deltaY: 0 };
}

/**
 * Attach mousedown / mousemove / mouseup listeners to the canvas.
 * Returns a cleanup function that removes all listeners (for Vite HMR).
 */
export function attachDragListeners(
  canvas: HTMLCanvasElement,
  state: DragState,
): () => void {
  function onMouseDown(e: MouseEvent) {
    state.isDragging = true;
    state.lastX = e.clientX;
    state.lastY = e.clientY;
  }

  function onMouseMove(e: MouseEvent) {
    if (!state.isDragging) return;
    state.deltaX += e.clientX - state.lastX;
    state.deltaY += e.clientY - state.lastY;
    state.lastX = e.clientX;
    state.lastY = e.clientY;
  }

  function onMouseUp() {
    state.isDragging = false;
  }

  canvas.addEventListener("mousedown", onMouseDown);
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);

  return () => {
    canvas.removeEventListener("mousedown", onMouseDown);
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
  };
}

/**
 * Read the accumulated drag delta since the last call, then reset it.
 * Call exactly once per frame from the game loop.
 */
export function consumeDelta(state: DragState): { dx: number; dy: number } {
  const dx = state.deltaX;
  const dy = state.deltaY;
  state.deltaX = 0;
  state.deltaY = 0;
  return { dx, dy };
}
