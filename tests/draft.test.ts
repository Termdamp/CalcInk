import { describe, expect, it } from 'vitest';
import { createDraft, createIdGenerator, type Draft } from '../src/strokes';
import { pt } from './helpers';

const newDraft = (): Draft => createDraft(createIdGenerator());

describe('draft', () => {
  it('drops jitter closer than the minimum distance', () => {
    const draft = newDraft();
    draft.begin(pt(0, 0), 4);
    draft.append([pt(0.1, 0.1), pt(5, 5)]);
    expect(draft.current?.points).toHaveLength(2);
  });

  it('finish hands over the stroke and clears the draft', () => {
    const draft = newDraft();
    draft.begin(pt(0, 0), 4);
    const stroke = draft.finish();
    expect(stroke?.width).toBe(4);
    expect(draft.current).toBeNull();
    expect(draft.finish()).toBeNull();
  });

  it('keeps a single-point stroke (a tap is a dot / decimal point)', () => {
    const draft = newDraft();
    draft.begin(pt(3, 3), 4);
    expect(draft.finish()?.points).toHaveLength(1);
  });

  it('cancel discards the stroke and notifies with null', () => {
    const draft = newDraft();
    const seen: Array<string | null> = [];
    draft.on('change', (stroke) => seen.push(stroke ? 'stroke' : null));
    draft.begin(pt(0, 0), 4);
    draft.cancel();
    expect(seen).toEqual(['stroke', null]);
    expect(draft.current).toBeNull();
  });

  it('never throws when used out of order', () => {
    const draft = newDraft();
    expect(() => {
      draft.append([pt(1, 1)]);
      draft.cancel();
      draft.finish();
    }).not.toThrow();
  });

  it('gives each stroke a unique id', () => {
    const draft = newDraft();
    draft.begin(pt(0, 0), 4);
    const first = draft.finish();
    draft.begin(pt(5, 5), 4);
    const second = draft.finish();
    expect(first?.id).not.toBe(second?.id);
  });
});