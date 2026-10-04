import type {Renderer, Viewport } from '../canvas';
import type { Size } from '../types';
/** Bottom-left readout of the three sizes that matter for HiDPI. */
export function installHud(viewport: Viewport): void {
  const el = document.createElement('div');
  el.className = 'hud';
  document.body.append(el);

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
  ctx.fillText('Crisp? 0123456789 + − × ÷ = .', 32, 40);
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillText(`canvas ${size.width.toFixed(0)}×${size.height.toFixed(0)} CSS px`, 32, 62);
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

/** Top-left readout of what kind of pointer you're using. Invaluable on a phone with no console. */
export function installPointerReadout(): void {
  const el = document.createElement('div');
  el.className = 'hud hud-top';
  el.textContent = 'draw to see pointer info';
  document.body.append(el);
  window.addEventListener('pointermove', (e) => {
    if (e.buttons === 0) return; // ignore hover
    el.textContent =
      `${e.pointerType} · pressure ${e.pressure.toFixed(2)} · ` +
      `contact ${e.width.toFixed(0)}×${e.height.toFixed(0)} · ` +
      `coalesced ${e.getCoalescedEvents().length}`;
  });
}