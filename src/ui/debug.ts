import type { Renderer, Viewport } from '../canvas';
import type { History, StrokeStore } from '../strokes';
import type { Size } from '../types';

let stack: HTMLElement | null = null;

function addRow(): HTMLElement {
  if (!stack) {
    stack = document.createElement('div');
    stack.className = 'hud-stack';
    document.body.append(stack);
  }
  const row = document.createElement('div');
  row.className = 'hud';
  stack.append(row);
  return row;
}

/** The three sizes that matter for HiDPI. */
export function installHud(viewport: Viewport): void {
  const el = addRow();
  const update = (): void => {
    const { width, height } = viewport.size;
    el.textContent =
      `css ${width.toFixed(0)}×${height.toFixed(0)} · dpr ${viewport.dpr.toFixed(2)} · ` +
      `bitmap ${viewport.canvas.width}×${viewport.canvas.height}`;
  };
  update();
  viewport.onChange(update);
}

/** Thin diagonals, circles and small text: blur and aliasing are easiest to spot on these. */
export function drawCrispnessPattern(ctx: CanvasRenderingContext2D, size: Size): void {
  ctx.save();
  ctx.strokeStyle = '#2b4acb';
  ctx.fillStyle = '#16161d';
  ctx.lineWidth = 1;

  ctx.beginPath();
  for (let deg = 0; deg <= 90; deg += 6) {
    const r = (deg * Math.PI) / 180;
    ctx.moveTo(32, 120);
    ctx.lineTo(32 + Math.cos(r) * 140, 120 + Math.sin(r) * 140);
  }
  ctx.stroke();

  for (const radius of [20, 40, 60]) {
    ctx.beginPath();
    ctx.arc(260, 190, radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.font = '14px system-ui, sans-serif';
  ctx.fillText('Crisp? 0123456789 + − × ÷ = .', 32, 100);
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillText(`canvas ${size.width.toFixed(0)}×${size.height.toFixed(0)} CSS px`, 32, 118);
  ctx.restore();
}

/** Press G to toggle the crispness pattern beneath your ink. */
export function installPatternToggle(renderer: Renderer): void {
  let on = false;
  window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() !== 'g') return;
    on = !on;
    renderer.setUnderlay(on ? drawCrispnessPattern : null);
    renderer.requestRender();
  });
}

/** What kind of pointer you're using. Invaluable on a phone with no console. */
export function installPointerReadout(): void {
  const el = addRow();
  el.textContent = 'draw to see pointer info';
  window.addEventListener('pointermove', (e) => {
    if (e.buttons === 0) return; // ignore hover
    el.textContent =
      `${e.pointerType} · pressure ${e.pressure.toFixed(2)} · ` +
      `contact ${e.width.toFixed(0)}×${e.height.toFixed(0)} · ` +
      `coalesced ${e.getCoalescedEvents().length}`;
  });
}

/** Time from the newest pointer event to the end of the render that drew it (software floor). */
export function installLatencyProbe(renderer: Renderer): void {
  const el = addRow();
  let lastInput: number | null = null;
  const record = (e: PointerEvent): void => {
    if (e.buttons !== 0) lastInput = e.timeStamp;
  };
  window.addEventListener('pointerdown', record, { capture: true });
  window.addEventListener('pointermove', record, { capture: true });

  const samples: number[] = [];
  renderer.onRendered(() => {
    if (lastInput === null) return;
    samples.push(performance.now() - lastInput);
    lastInput = null; // count each input once
    if (samples.length > 120) samples.shift();
    const sorted = [...samples].sort((a, b) => a - b);
    const avg = samples.reduce((sum, v) => sum + v, 0) / samples.length;
    const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
    el.textContent = `input→render avg ${avg.toFixed(1)} ms · p95 ${p95.toFixed(1)} ms`;
  });
}

/** Stroke count and history depth: makes "one drag = one undo step" visible. */
export function installDocumentReadout(store: StrokeStore, history: History): void {
  const el = addRow();
  const update = (): void => {
    el.textContent = `strokes ${store.strokes.length} · undo ${history.undoCount} · redo ${history.redoCount}`;
  };
  update();
  store.on('change', update);
  history.on('change', update);
}