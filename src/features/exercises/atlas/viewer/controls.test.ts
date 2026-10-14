import { fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { attachControls, type ControlHandlers } from './controls';

function setup() {
  const element = document.createElement('div');
  const handlers: { [K in keyof ControlHandlers]: ReturnType<typeof vi.fn> } = {
    rotate: vi.fn(),
    pan: vi.fn(),
    zoomAt: vi.fn(),
    tap: vi.fn(),
    doubleTap: vi.fn(),
  };
  const detach = attachControls(element, handlers as unknown as ControlHandlers);
  return { element, handlers, detach };
}

const finger = (id: number, x: number, y: number) => ({
  pointerId: id,
  pointerType: 'touch',
  button: 0,
  clientX: x,
  clientY: y,
});

describe('Gestes sur la vue 3D', () => {
  let ctx: ReturnType<typeof setup>;
  beforeEach(() => {
    ctx = setup();
  });

  it('un toucher bref choisit, deux touchers rapprochés recentrent', () => {
    fireEvent.pointerDown(ctx.element, finger(1, 10, 10));
    fireEvent.pointerUp(ctx.element, finger(1, 12, 11));
    expect(ctx.handlers.tap).toHaveBeenCalledWith(12, 11);
    fireEvent.pointerDown(ctx.element, finger(1, 14, 12));
    fireEvent.pointerUp(ctx.element, finger(1, 14, 12));
    expect(ctx.handlers.doubleTap).toHaveBeenCalledTimes(1);
    expect(ctx.handlers.tap).toHaveBeenCalledTimes(1);
  });

  it('glisser un doigt fait tourner, sans choisir', () => {
    fireEvent.pointerDown(ctx.element, finger(1, 100, 100));
    fireEvent.pointerMove(ctx.element, finger(1, 140, 90));
    fireEvent.pointerUp(ctx.element, finger(1, 140, 90));
    expect(ctx.handlers.rotate).toHaveBeenCalledWith(40, -10);
    expect(ctx.handlers.tap).not.toHaveBeenCalled();
  });

  it('pincer à deux doigts zoome autour du milieu des doigts', () => {
    fireEvent.pointerDown(ctx.element, finger(1, 100, 100));
    fireEvent.pointerDown(ctx.element, finger(2, 200, 100));
    fireEvent.pointerMove(ctx.element, finger(2, 300, 100));
    expect(ctx.handlers.zoomAt).toHaveBeenCalledWith(2, 200, 100);
    expect(ctx.handlers.pan).toHaveBeenCalledWith(50, 0);
    expect(ctx.handlers.rotate).not.toHaveBeenCalled();
    fireEvent.pointerUp(ctx.element, finger(2, 300, 100));
    fireEvent.pointerUp(ctx.element, finger(1, 100, 100));
    expect(ctx.handlers.tap).not.toHaveBeenCalled();
  });

  it('la molette zoome ; plus rien après détachement', () => {
    fireEvent.wheel(ctx.element, { deltaY: -100, clientX: 5, clientY: 6 });
    expect(ctx.handlers.zoomAt).toHaveBeenCalledTimes(1);
    const [factor] = ctx.handlers.zoomAt.mock.calls[0] as [number];
    expect(factor).toBeGreaterThan(1);
    ctx.detach();
    fireEvent.wheel(ctx.element, { deltaY: -100 });
    fireEvent.pointerDown(ctx.element, finger(1, 10, 10));
    fireEvent.pointerUp(ctx.element, finger(1, 10, 10));
    expect(ctx.handlers.zoomAt).toHaveBeenCalledTimes(1);
    expect(ctx.handlers.tap).not.toHaveBeenCalled();
  });
});
