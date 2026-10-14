import { describe, expect, it } from 'vitest';
import {
  clampState,
  halfHeightAt,
  HOME,
  homeDistance,
  isCentered,
  MAX_ZOOM,
  nearestAngle,
  VIEW_YAW,
  viewOf,
  zoomAround,
} from './camera';

const FRAME = { height: 1.8, width: 0.6 };

describe('Cadrage', () => {
  it('fait tenir le corps entier, en hauteur sur un écran de téléphone', () => {
    const distance = homeDistance(FRAME, 390 / 560);
    expect(halfHeightAt(distance) * 2).toBeGreaterThan(FRAME.height);
    expect(halfHeightAt(distance) * 2).toBeLessThan(FRAME.height * 1.15);
    // Moins de place libre (boutons en haut) : la caméra recule.
    expect(homeDistance(FRAME, 390 / 560, 0.8)).toBeGreaterThan(distance);
    // Écran très large et bas : c'est la largeur qui compte.
    expect(homeDistance(FRAME, 0.2)).toBeGreaterThan(distance);
  });

  it('garde le corps centré à zoom 1 et limite le décalage ensuite', () => {
    const centered = clampState({ ...HOME, panX: 1, panY: -1 }, FRAME);
    expect(Math.abs(centered.panX) + Math.abs(centered.panY)).toBe(0);
    const zoomed = clampState({ ...HOME, zoom: 2, panY: 5, pitch: 3 }, FRAME);
    expect(zoomed.panY).toBeCloseTo(FRAME.height / 4);
    expect(zoomed.pitch).toBeLessThan(1);
    expect(clampState({ ...HOME, zoom: 99 }, FRAME).zoom).toBe(MAX_ZOOM);
    expect(clampState({ ...HOME, zoom: 0.1 }, FRAME).zoom).toBe(1);
  });

  it('zoome vers le doigt : le point visé reste sous le doigt', () => {
    const aspect = 0.7;
    const start = { ...HOME, zoom: 2 };
    const ndcY = -0.4;
    const before = start.panY + ndcY * halfHeightAt(homeDistance(FRAME, aspect) / start.zoom);
    const next = zoomAround(start, 1.5, 0, ndcY, FRAME, aspect);
    const after = next.panY + ndcY * halfHeightAt(homeDistance(FRAME, aspect) / next.zoom);
    expect(next.zoom).toBe(3);
    expect(after).toBeCloseTo(before);
  });

  it('tourne par le plus court chemin et reconnaît les vues', () => {
    expect(nearestAngle(2 * Math.PI + 0.1, 0)).toBeCloseTo(2 * Math.PI);
    expect(nearestAngle(Math.PI, -Math.PI / 2)).toBeCloseTo((3 * Math.PI) / 2);
    expect(viewOf({ ...HOME, yaw: 4 * Math.PI + VIEW_YAW.back })).toBe('back');
    expect(viewOf({ ...HOME, yaw: VIEW_YAW.left })).toBe('left');
    expect(viewOf({ ...HOME, yaw: 0.6 })).toBeNull();
    expect(viewOf({ ...HOME, pitch: 0.4 })).toBeNull();
    expect(isCentered(HOME)).toBe(true);
    expect(isCentered({ ...HOME, zoom: 1.5 })).toBe(false);
  });
});
