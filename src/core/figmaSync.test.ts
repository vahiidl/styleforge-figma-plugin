// Idempotence + integration tests for the sync engine against an in-memory
// mock of the Figma variables/styles API.

import { describe, it, expect, beforeEach } from 'vitest';
import { importThemeTokens, type ThemeImportOptions } from './figmaSync';

// ─── Minimal in-memory figma mock ────────────────────────────────────────────

interface MockVariable {
    id: string;
    name: string;
    variableCollectionId: string;
    resolvedType: string;
    valuesByMode: Record<string, unknown>;
    scopes: string[];
    codeSyntax: Record<string, string>;
    setValueForMode(modeId: string, value: unknown): void;
    setVariableCodeSyntax(platform: string, value: string): void;
}

function createFigmaMock(opts?: { maxModes?: number }) {
    const maxModes = opts?.maxModes ?? Infinity;
    let idCounter = 0;
    const collections: any[] = [];
    const variables: MockVariable[] = [];
    const effectStyles: any[] = [];
    const textStyles: any[] = [];

    const figmaMock = {
        variables: {
            async getLocalVariableCollectionsAsync() { return collections; },
            async getLocalVariablesAsync(_type?: string) {
                return _type ? variables.filter(v => v.resolvedType === _type) : variables;
            },
            createVariableCollection(name: string) {
                const col = {
                    id: 'col-' + (++idCounter),
                    name,
                    modes: [{ name: 'Mode 1', modeId: 'mode-' + (++idCounter) }],
                    renameMode(modeId: string, newName: string) {
                        const m = col.modes.find((mm: any) => mm.modeId === modeId);
                        if (m) m.name = newName;
                    },
                    addMode(name2: string) {
                        if (col.modes.length >= maxModes) {
                            throw new Error('in addMode: Limited to ' + maxModes + ' modes only');
                        }
                        const modeId = 'mode-' + (++idCounter);
                        col.modes.push({ name: name2, modeId });
                        return modeId;
                    },
                };
                collections.push(col);
                return col;
            },
            createVariable(name: string, collection: any, type: string) {
                const v: MockVariable = {
                    id: 'var-' + (++idCounter),
                    name,
                    variableCollectionId: collection.id,
                    resolvedType: type,
                    valuesByMode: {},
                    scopes: [],
                    codeSyntax: {},
                    setValueForMode(modeId, value) { v.valuesByMode[modeId] = value; },
                    setVariableCodeSyntax(platform, value) { v.codeSyntax[platform] = value; },
                };
                variables.push(v);
                return v;
            },
        },
        async getLocalEffectStylesAsync() { return effectStyles; },
        createEffectStyle() {
            const s = { id: 'eff-' + (++idCounter), name: '', effects: [] as unknown[] };
            effectStyles.push(s);
            return s;
        },
        async getLocalTextStylesAsync() { return textStyles; },
        createTextStyle() {
            const s: any = { id: 'txt-' + (++idCounter), name: '', fontName: null, fontSize: 0 };
            textStyles.push(s);
            return s;
        },
        async loadFontAsync(_font: unknown) { /* always available in mock */ },
    };

    return { figmaMock, collections, variables, effectStyles, textStyles };
}

const baseOptions = {
    importColors: true, importSpacing: false, importRadius: true, importShadows: true,
    importBlur: false, importTypography: false, importBreakpoints: false,
    importContainers: false, importFontWeights: false, importTracking: false,
    importLeading: false, importMaxWidth: false, importBorderWidth: false,
    importOpacity: false, importSkew: false,
};

function themeOptions(): ThemeImportOptions {
    return {
        ...baseOptions,
        collectionName: 'Shadcn',
        primitiveCollectionName: 'TailwindCSS',
        lightTokens: {
            '--background': 'oklch(1 0 0)',
            '--primary': 'oklch(0.205 0 0)',
            '--radius': '0.625rem',
        },
        darkTokens: {
            '--background': 'oklch(0.145 0 0)',
            '--primary': 'oklch(0.922 0 0)',
        },
        extras: {
            stateColors: [{ name: 'state/ring-50', light: 'rgba(163,163,163,0.5)', dark: 'rgba(115,115,115,0.5)', codeSyntax: '--ring 50%' }],
            strings: [{ name: 'typography/font-sans', value: 'Geist', scopes: ['FONT_FAMILY'] }],
            shadows: [{ name: 'shadow/xs', value: '0 1px 2px 0 rgb(0 0 0 / 0.05)' }],
            textStyles: [{ name: 'mui/h1', family: 'Inter', fontSize: 96, fontWeight: 300, lineHeight: 1.167 }],
        },
    };
}

describe('importThemeTokens against figma mock', () => {
    let mock: ReturnType<typeof createFigmaMock>;

    beforeEach(() => {
        mock = createFigmaMock();
        (globalThis as Record<string, unknown>).figma = mock.figmaMock;
    });

    it('creates Light/Dark modes, color + float variables, radius scale, extras', async () => {
        await importThemeTokens(themeOptions());

        const col = mock.collections.find(c => c.name === 'Shadcn');
        expect(col).toBeDefined();
        expect(col.modes.map((m: any) => m.name)).toEqual(['Light', 'Dark']);

        const names = mock.variables.map(v => v.name);
        expect(names).toContain('background');
        expect(names).toContain('primary');
        expect(names).toContain('radius');
        // derived scale
        for (const s of ['radius-sm', 'radius-md', 'radius-lg', 'radius-xl', 'radius-2xl', 'radius-3xl', 'radius-4xl']) {
            expect(names).toContain(s);
        }
        const radiusMd = mock.variables.find(v => v.name === 'radius-md')!;
        expect(Object.values(radiusMd.valuesByMode)[0]).toBe(8);

        // extras
        expect(names).toContain('state/ring-50');
        expect(names).toContain('typography/font-sans');
        expect(mock.effectStyles.find(s => s.name === 'shadow/xs')).toBeDefined();
        expect(mock.textStyles.find(s => s.name === 'mui/h1')).toBeDefined();

        // code syntax everywhere
        const bg = mock.variables.find(v => v.name === 'background')!;
        expect(bg.codeSyntax['WEB']).toBe('var(--background)');
    });

    it('is idempotent: re-importing creates zero duplicates', async () => {
        await importThemeTokens(themeOptions());
        const afterFirst = {
            collections: mock.collections.length,
            variables: mock.variables.length,
            effects: mock.effectStyles.length,
            texts: mock.textStyles.length,
        };

        await importThemeTokens(themeOptions());

        expect(mock.collections.length).toBe(afterFirst.collections);
        expect(mock.variables.length).toBe(afterFirst.variables);
        expect(mock.effectStyles.length).toBe(afterFirst.effects);
        expect(mock.textStyles.length).toBe(afterFirst.texts);
    });

    it('sets both mode values for colors present in both themes', async () => {
        await importThemeTokens(themeOptions());
        const primary = mock.variables.find(v => v.name === 'primary')!;
        expect(Object.keys(primary.valuesByMode)).toHaveLength(2);
    });

    it('degrades to Light-only on Free/Starter files (addMode plan limit)', async () => {
        const limited = createFigmaMock({ maxModes: 1 });
        (globalThis as Record<string, unknown>).figma = limited.figmaMock;

        const info = await importThemeTokens(themeOptions());

        // Import succeeded despite the plan limit and reported it
        expect(info.modeLimited).toBe(true);

        // Single mode, renamed Light, with light values only
        const col = limited.collections.find(c => c.name === 'Shadcn');
        expect(col.modes).toHaveLength(1);
        expect(col.modes[0].name).toBe('Light');

        const primary = limited.variables.find(v => v.name === 'primary')!;
        expect(Object.keys(primary.valuesByMode)).toHaveLength(1);
        const light = primary.valuesByMode[col.modes[0].modeId] as { r: number };
        // oklch(0.205 0 0) light value, not the dark 0.922
        expect(Math.round(light.r * 255)).toBe(23);

        // Radius scale, extras and styles still created in the single mode
        expect(limited.variables.find(v => v.name === 'radius-md')).toBeDefined();
        expect(limited.variables.find(v => v.name === 'state/ring-50')).toBeDefined();
        expect(limited.effectStyles.find(s => s.name === 'shadow/xs')).toBeDefined();

        // Idempotent under the limit too
        const count = limited.variables.length;
        await importThemeTokens(themeOptions());
        expect(limited.variables.length).toBe(count);
    });
});
