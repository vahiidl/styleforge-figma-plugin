import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { shadcnAdapter, parseThemesTs, alphaVariant, buildStateExtras } from './shadcnAdapter';
import { radixColorsAdapter } from './radixColorsAdapter';
import { muiAdapter } from './muiAdapter';
import { chakraAdapter } from './chakraAdapter';
import { mantineAdapter } from './mantineAdapter';
import { daisyuiAdapter } from './daisyuiAdapter';
import { bootstrapAdapter } from './bootstrapAdapter';
import { getAllAdapters, getAdapter, resolveAdapters } from './registry';
import { clearCache } from '../core/fetcher';

beforeEach(() => {
    clearCache();
    // Force offline so adapters exercise their bundled fallbacks deterministically.
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
});
afterEach(() => {
    vi.unstubAllGlobals();
});

describe('registry', () => {
    it('registers all ten adapters', () => {
        expect(getAllAdapters()).toHaveLength(10);
        for (const id of ['tailwindcss', 'shadcn', 'base-ui', 'coss', 'radix-colors', 'mui', 'chakra', 'mantine', 'daisyui', 'bootstrap']) {
            expect(getAdapter(id), id).toBeDefined();
        }
    });

    it('resolves dependencies before dependents', () => {
        const chain = resolveAdapters(['shadcn']);
        expect(chain.map(a => a.id)).toEqual(['tailwindcss', 'shadcn']);
    });
});

describe('shadcn adapter', () => {
    it('falls back to the bundled snapshot offline and reports it', async () => {
        const result = await shadcnAdapter.fetchAndParse({ baseColor: 'neutral' });
        expect(result.type).toBe('theme');
        expect(result.source?.kind).toBe('bundled');
        if (result.type === 'theme') {
            // Current neutral theme goldens (grayscale chart ramp, no destructive-foreground)
            expect(result.tokens.light['--chart-1']).toBe('oklch(0.87 0 0)');
            expect(result.tokens.dark['--popover']).toBe('oklch(0.205 0 0)');
            expect(result.tokens.light['--destructive-foreground']).toBeUndefined();
            expect(result.tokens.light['--radius']).toBe('0.625rem');
        }
    });

    it('merges an accent theme over the base', async () => {
        const result = await shadcnAdapter.fetchAndParse({ baseColor: 'neutral', accent: 'blue' });
        if (result.type === 'theme') {
            expect(result.tokens.light['--primary']).toBe('oklch(0.488 0.243 264.376)');
            // Non-accent keys still come from the base
            expect(result.tokens.light['--background']).toBe('oklch(1 0 0)');
        }
    });

    it('emits state recipes and shadow tiers as extras', async () => {
        const result = await shadcnAdapter.fetchAndParse({ baseColor: 'neutral' });
        expect(result.extras?.stateColors?.find(s => s.name === 'state/ring-50')).toBeDefined();
        expect(result.extras?.shadows?.find(s => s.name === 'shadow/md')).toBeDefined();
        expect(result.extras?.strings?.find(s => s.value === 'Geist')).toBeDefined();
    });

    it('parses a themes.ts source snippet', () => {
        const src = `export const THEMES = [
  {
    name: "neutral",
    title: "Neutral",
    type: "registry:theme",
    cssVars: {
      light: {
        background: "oklch(1 0 0)",
        "chart-1": "oklch(0.87 0 0)",
      },
      dark: {
        background: "oklch(0.145 0 0)",
      },
    },
  },
]`;
        const themes = parseThemesTs(src);
        expect(themes.neutral.light['chart-1']).toBe('oklch(0.87 0 0)');
        expect(themes.neutral.dark['background']).toBe('oklch(0.145 0 0)');
    });

    it('computes alpha variants for state recipes', () => {
        expect(alphaVariant('oklch(1 0 0 / 15%)', 0.3)).toBe('rgba(255, 255, 255, 0.045)');
        const extras = buildStateExtras(
            { ring: 'oklch(0.708 0 0)', muted: 'oklch(0.97 0 0)', accent: 'oklch(0.97 0 0)', destructive: 'oklch(0.577 0.245 27.325)', input: 'oklch(0.922 0 0)' },
            { ring: 'oklch(0.556 0 0)', muted: 'oklch(0.269 0 0)', accent: 'oklch(0.269 0 0)', destructive: 'oklch(0.704 0.191 22.216)', input: 'oklch(1 0 0 / 15%)' }
        );
        const ring = extras!.find(e => e.name === 'state/ring-50')!;
        expect(ring.light).toMatch(/rgba\(\d+, \d+, \d+, 0.5\)/);
    });
});

describe('new adapters (bundled snapshots)', () => {
    it('radix: pairs light/dark scales with alpha steps', async () => {
        const result = await radixColorsAdapter.fetchAndParse();
        if (result.type === 'theme') {
            expect(Object.keys(result.tokens.light).length).toBeGreaterThan(700);
            expect(result.tokens.light['blue/9']).toBeDefined();
            expect(result.tokens.dark['blue/9']).toBeDefined();
            expect(result.tokens.light['blue/a9']).toBeDefined();
        }
    });

    it('mui: colors + elevation shadows + typography extras', async () => {
        const result = await muiAdapter.fetchAndParse();
        if (result.type === 'theme') {
            expect(result.tokens.light['--primary/main']).toBe('#1976d2');
            expect(result.tokens.dark['--background/default']).toBe('#121212');
        }
        expect(result.extras?.shadows?.length).toBe(24);
        expect(result.extras?.textStyles?.find(t => t.name === 'mui/h1')).toBeDefined();
    });

    it('chakra: primitives with color scales, spacing, radii, shadows', async () => {
        const result = await chakraAdapter.fetchAndParse();
        if (result.type === 'primitives') {
            expect(result.tokens.colors.length).toBeGreaterThan(100);
            expect(result.tokens.colors.find(c => c.path.join('/') === 'blue/500')).toBeDefined();
            expect(result.tokens.spacing.length).toBeGreaterThan(10);
            expect(result.tokens.shadows.length).toBeGreaterThan(3);
        }
    });

    it('mantine: 10-step scales', async () => {
        const result = await mantineAdapter.fetchAndParse();
        if (result.type === 'primitives') {
            expect(result.tokens.colors.find(c => c.path.join('/') === 'blue/6')).toBeDefined();
            expect(result.tokens.radius.length).toBeGreaterThan(3);
        }
    });

    it('daisyui: light/dark oklch tokens + radius floats', async () => {
        const result = await daisyuiAdapter.fetchAndParse();
        if (result.type === 'theme') {
            expect(result.tokens.light['--primary']).toBeDefined();
            expect(Object.keys(result.tokens.dark).length).toBeGreaterThan(10);
        }
        expect(result.extras?.floats?.some(f => f.name.startsWith('radius/'))).toBe(true);
    });

    it('bootstrap: --bs palette with dark overrides, -rgb helpers dropped', async () => {
        const result = await bootstrapAdapter.fetchAndParse();
        if (result.type === 'theme') {
            expect(result.tokens.light['--primary']).toBe('#0d6efd');
            expect(result.tokens.light['--primary-rgb']).toBeUndefined();
            expect(result.tokens.dark['--body-bg']).toBeDefined();
            expect(result.tokens.dark['--body-bg']).not.toBe(result.tokens.light['--body-bg']);
        }
    });
});
