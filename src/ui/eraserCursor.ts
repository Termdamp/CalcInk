import type { ToolController } from './tools';

export function createEraserCursor(tools: ToolController, radius: number): void {
  const ring = document.createElement('div');
  ring.className = 'eraser-cursor';
  ring.style.width = `${radius * 2}px`;
  ring.style.height = `${radius * 2}px`;
  ring.hidden = true;
  document.body.append(ring);

  const isEraser = (): boolean => tools.tool !== 'pen';
  const sync = (): void => {
    document.body.classList.toggle('erasing', isEraser()); // hides the native cursor over the canvas
    if (!isEraser()) ring.hidden = true;
  };
  tools.on('change', sync);
  sync();

  window.addEventListener('pointermove', (e) => {
    const overToolbar = e.target instanceof Element && e.target.closest('.toolbar') !== null;
    const touchHover = e.pointerType === 'touch' && e.buttons === 0;
    if (!isEraser() || overToolbar || touchHover) {
      ring.hidden = true;
      return;
    }
    ring.hidden = false;
    ring.style.transform = `translate(${e.clientX - radius}px, ${e.clientY - radius}px)`;
  });
  window.addEventListener('pointerup', (e) => {
    if (e.pointerType === 'touch') ring.hidden = true;
  });
  document.documentElement.addEventListener('pointerleave', () => {
    ring.hidden = true;
  });
}