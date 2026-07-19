import { describe, it, expect } from 'vitest';
import { parseThemeBlock, parseRootAndDark, parseShadowValue, categorizeTokens, extractCSSVariables } from './parser';
import { diffCollection, planFromThemeTokens } from './diffEngine';
import { readFileSync } from 'node:fs';

const fallbackCss = readFileSync(new URL('../data/tailwind-theme.css.txt', import.meta.url), 'utf8');

describe('Tailwind theme.css parsing (bundled snapshot)', () => {
    const vars = (() => {
        let v = parseThemeBlock(fallbackCss);
        if (v.length === 0) v = extractCSSVariables(fallbackCss);
        return v;
    })();
    const tokens = categorizeTokens(vars);

    it('finds a full color palette', () => {
        expect(tokens.colors.length).toBeGreaterThan(200);
        const red500 = tokens.colors.find(c => c.path.join('-') === 'red-500');
        expect(red500).toBeDefined();
    });

    it('generates the spacing scale from the base value', () => {
        expect(tokens.spacing.length).toBeGreaterThan(20);
        const four = tokens.spacing.find(s => s.path[0] === '4');
        expect(four?.value).toBe(16);
    });

    it('parses shadow tiers with multiple layers', () => {
        const md = tokens.shadows.find(s => s.name === 'drop-shadow/md' || s.name.endsWith('/md'));
        expect(md).toBeDefined();
    });
});

describe('parseShadowValue', () => {
    it('parses multi-layer shadows with slash alpha', () => {
        const layers = parseShadowValue('0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)');
        expect(layers).toHaveLength(2);
        expect(layers[0]).toMatchObject({ x: 0, y: 4, blur: 6, spread: -1, type: 'DROP_SHADOW' });
        expect(layers[0].color.a).toBeCloseTo(0.1, 5);
    });

    it('parses MUI-style comma rgba shadows', () => {
        const layers = parseShadowValue('0px 2px 1px -1px rgba(0,0,0,0.2),0px 1px 1px 0px rgba(0,0,0,0.14)');
        expect(layers).toHaveLength(2);
        expect(layers[1].blur).toBe(1);
    });

    it('marks inset shadows as INNER_SHADOW', () => {
        const layers = parseShadowValue('inset 0 2px 4px rgb(0 0 0 / 0.05)');
        expect(layers[0].type).toBe('INNER_SHADOW');
    });
});

describe('parseRootAndDark', () => {
    it('splits light and dark blocks', () => {
        const css = `:root { --a: #fff; --r: 0.5rem; } .dark { --a: #000; }`;
        const { light, dark } = parseRootAndDark(css);
        expect(light['--a']).toBe('#fff');
        expect(dark['--a']).toBe('#000');
        expect(light['--r']).toBe('0.5rem');
    });
});

describe('diff engine', () => {
    const planned = planFromThemeTokens(
        { '--primary': '#111111', '--added': '#222222' },
        { '--primary': '#eeeeee' }
    );

    it('flags everything as added for a new collection', () => {
        const diff = diffCollection('Theme', planned, null);
        expect(diff.isNew).toBe(true);
        expect(diff.added).toHaveLength(2);
    });

    it('detects changed color values per mode', () => {
        const diff = diffCollection('Theme', planned, [
            { name: 'primary', resolvedType: 'COLOR', values: { Light: { r: 0, g: 0, b: 0, a: 1 }, Dark: { r: 0.933, g: 0.933, b: 0.933, a: 1 } } },
        ]);
        // Light differs (#111 vs #000); Dark matches (#eee ≈ 0.933)
        expect(diff.added).toEqual(['added']);
        expect(diff.changed).toHaveLength(1);
        expect(diff.changed[0].mode).toBe('Light');
    });

    it('reports identical values as unchanged', () => {
        const diff = diffCollection('Theme', [{ name: 'primary', light: '#000000' }], [
            { name: 'primary', resolvedType: 'COLOR', values: { Light: { r: 0, g: 0, b: 0, a: 1 } } },
        ]);
        expect(diff.changed).toHaveLength(0);
        expect(diff.added).toHaveLength(0);
    });
});
