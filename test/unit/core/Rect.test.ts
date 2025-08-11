import Rect from '@giro3d/giro3d/core/Rect';
import { describe, expect, it } from 'vitest';

describe('constructor', () => {
    it('should assign all properties', () => {
        const rect = new Rect(1, 2, 3, 4);
        expect(rect.xMin).toEqual(1);
        expect(rect.xMax).toEqual(2);
        expect(rect.yMin).toEqual(3);
        expect(rect.yMax).toEqual(4);
    });
});

describe('left, right, top, bottom', () => {
    it('should return the associated properties', () => {
        const rect = new Rect(1, 2, 3, 4);
        expect(rect.left).toEqual(1);
        expect(rect.right).toEqual(2);
        expect(rect.bottom).toEqual(3);
        expect(rect.top).toEqual(4);
    });
});

describe('width, height', () => {
    it('should return the correct dimensions', () => {
        const rect = new Rect(0, 2, -1, 4);
        expect(rect.width).toEqual(2);
        expect(rect.height).toEqual(5);
    });
});

describe('centerX, centerY', () => {
    it('should return the correct center coordinates', () => {
        const rect = new Rect(0, 2, -1, 4);
        expect(rect.centerX).toEqual(1);
        expect(rect.centerY).toEqual(1.5);
    });
});

describe('getNormalizedRect', () => {
    it('should return 0 0 1 1 if both rects are the same', () => {
        const src = new Rect(-1, 23, -134, 234);
        const dst = new Rect(-1, 23, -134, 234);
        const { x, y, w, h } = Rect.getNormalizedRect(src, dst);

        expect(x).toBe(0);
        expect(y).toBe(0);
        expect(w).toBe(1);
        expect(h).toBe(1);
    });

    it('should return 0 0.5 0.5 0.5 if source is the bottom left quadrant', () => {
        const src = new Rect(0, 10, 0, 10);
        const dst = new Rect(0, 20, 0, 20);
        const { x, y, w, h } = Rect.getNormalizedRect(src, dst);

        expect(x).toBe(0);
        expect(y).toBe(0.5);
        expect(w).toBe(0.5);
        expect(h).toBe(0.5);
    });

    it('should return 0 0 0.5 0.5 if source is the top left quadrant', () => {
        const src = new Rect(0, 10, 10, 20);
        const dst = new Rect(0, 20, 0, 20);
        const { x, y, w, h } = Rect.getNormalizedRect(src, dst);

        expect(x).toBe(0);
        expect(y).toBe(0);
        expect(w).toBe(0.5);
        expect(h).toBe(0.5);
    });

    it('should return 0.5 0.5 0.5 0.5 if source is the bottom right quadrant', () => {
        const src = new Rect(10, 20, 0, 10);
        const dst = new Rect(0, 20, 0, 20);
        const { x, y, w, h } = Rect.getNormalizedRect(src, dst);

        expect(x).toBe(0.5);
        expect(y).toBe(0.5);
        expect(w).toBe(0.5);
        expect(h).toBe(0.5);
    });

    it('should return 0.5 0 0.5 0.5 if source is the top right quadrant', () => {
        const src = new Rect(10, 20, 10, 20);
        const dst = new Rect(0, 20, 0, 20);
        const { x, y, w, h } = Rect.getNormalizedRect(src, dst);

        expect(x).toBe(0.5);
        expect(y).toBe(0);
        expect(w).toBe(0.5);
        expect(h).toBe(0.5);
    });

    it('should return -0.5 -0.5 2 2 if source is twice as big as dest, and centered', () => {
        const src = new Rect(-10, 30, -10, 30);
        const dst = new Rect(0, 20, 0, 20);
        const { x, y, w, h } = Rect.getNormalizedRect(src, dst);

        expect(x).toBe(-0.5);
        expect(y).toBe(-0.5);
        expect(w).toBe(2);
        expect(h).toBe(2);
    });
});
