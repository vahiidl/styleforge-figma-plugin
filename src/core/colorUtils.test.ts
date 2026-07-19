import { describe, it, expect } from 'vitest';
import { parseColorValue, oklchToRgba, hexToRgba, parseDimension, colorsMatch } from './colorUtils';

// Golden values validated against CSS Color 4 reference math (see shadcn design system build).
describe('oklch → sRGB', () => {
    it('converts achromatic values to the Tailwind neutral scale', () => {
        // oklch(0.985 0 0) → #FAFAFA
        const c = oklchToRgba(0.985, 0, 0);
        expect(Math.round(c.r * 255)).toBe(250);
        expect(Math.round(c.g * 255)).toBe(250);
        expect(Math.round(c.b * 255)).toBe(250);
    });

    it('converts oklch(0.145 0 0) to #0A0A0A', () => {
        const c = oklchToRgba(0.145, 0, 0);
        expect(Math.round(c.r * 255)).toBe(10);
    });

    it('converts chromatic red (shadcn destructive)', () => {
        // oklch(0.577 0.245 27.325) → #E7000B
        const c = oklchToRgba(0.577, 0.245, 27.325);
        expect(Math.round(c.r * 255)).toBe(231);
        expect(Math.round(c.g * 255)).toBe(0);
        expect(Math.round(c.b * 255)).toBe(11);
    });

    it('converts Tailwind blue-500', () => {
        // oklch(0.623 0.214 259.815) → #2B7FFF
        const c = oklchToRgba(0.623, 0.214, 259.815);
        expect(Math.round(c.r * 255)).toBe(43);
        expect(Math.round(c.g * 255)).toBe(127);
        expect(Math.round(c.b * 255)).toBe(255);
    });
});

describe('parseColorValue', () => {
    it('parses oklch with percent lightness', () => {
        const c = parseColorValue('oklch(100% 0 0)');
        expect(c).not.toBeNull();
        expect(c!.r).toBeCloseTo(1, 2);
    });

    it('parses oklch with percentage alpha (dark shadcn borders)', () => {
        const c = parseColorValue('oklch(1 0 0 / 10%)');
        expect(c).not.toBeNull();
        expect(c!.a).toBeCloseTo(0.1, 5);
        expect(c!.r).toBeCloseTo(1, 2);
    });

    it('parses oklch with decimal alpha', () => {
        const c = parseColorValue('oklch(0.5 0 0 / 0.5)');
        expect(c!.a).toBeCloseTo(0.5, 5);
    });

    it('parses hex, hex8, and short hex', () => {
        expect(parseColorValue('#ff0000')).toEqual({ r: 1, g: 0, b: 0, a: 1 });
        expect(parseColorValue('#ff000080')!.a).toBeCloseTo(0.5, 1);
        expect(parseColorValue('#f00')).toEqual({ r: 1, g: 0, b: 0, a: 1 });
    });

    it('parses rgb()/rgba() in both comma and space syntax', () => {
        expect(parseColorValue('rgb(255, 0, 0)')).toEqual({ r: 1, g: 0, b: 0, a: 1 });
        expect(parseColorValue('rgb(0 0 0 / 0.5)')!.a).toBeCloseTo(0.5, 5);
        expect(parseColorValue('rgba(0, 0, 0, 0.12)')!.a).toBeCloseTo(0.12, 5);
    });

    it('parses hsl()', () => {
        const c = parseColorValue('hsl(0, 100%, 50%)');
        expect(c!.r).toBeCloseTo(1, 2);
        expect(c!.g).toBeCloseTo(0, 2);
    });

    it('parses named colors and transparent', () => {
        expect(parseColorValue('white')).toEqual({ r: 1, g: 1, b: 1, a: 1 });
        expect(parseColorValue('transparent')!.a).toBe(0);
    });

    it('returns null for non-colors', () => {
        expect(parseColorValue('0.625rem')).toBeNull();
        expect(parseColorValue('calc(1 + 1)')).toBeNull();
    });
});

describe('parseDimension', () => {
    it('converts rem to px at 16px base', () => {
        expect(parseDimension('0.625rem')).toBe(10);
        expect(parseDimension('1rem')).toBe(16);
    });
    it('passes px through and handles negatives', () => {
        expect(parseDimension('4px')).toBe(4);
        expect(parseDimension('-0.05em')).toBeCloseTo(-0.8, 5);
    });
    it('returns null for junk', () => {
        expect(parseDimension('auto')).toBeNull();
    });
});

describe('colorsMatch', () => {
    it('matches within tolerance and distinguishes alpha', () => {
        const a = hexToRgba('#e5e5e5');
        const b = { r: a.r + 0.001, g: a.g, b: a.b, a: 1 };
        expect(colorsMatch(a, b)).toBe(true);
        expect(colorsMatch(a, { ...a, a: 0.5 })).toBe(false);
    });
});
