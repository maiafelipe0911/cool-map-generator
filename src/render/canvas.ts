/**
 * canvas.ts
 * ---------
 * Acquires the HTML5 Canvas element, sizes it to fill the viewport, and
 * exposes the 2D rendering context. Handles window resize events.
 */

export interface CanvasHandle {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  /** Remove the resize listener. Call on HMR dispose. */
  cleanup: () => void;
}

/**
 * Initialize the canvas for drawing.
 * Grabs the element by ID (defaults to "wfc-canvas"), sets it to full
 * viewport size, attaches a resize listener, and returns the handle.
 */
export function initCanvas(canvasId = "wfc-canvas"): CanvasHandle {
  const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const ctx = canvas.getContext("2d")!;

  function onResize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  window.addEventListener("resize", onResize);

  return {
    canvas,
    ctx,
    cleanup: () => window.removeEventListener("resize", onResize),
  };
}
