// End-to-end pipeline test: every registered adapter's REAL output (bundled
// snapshots, offline) is pushed through the actual import engine against the
// in-memory Figma mock — the same code path the plugin runs in Figma.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { importPrimitives, importThemeTokens, type ImportOptions } from './figmaSync';
import { getAllAdapters } from '../adapters/registry';
import { clearCache } from './fetcher';

// ─── Figma mock (superset of figmaSync's needs, incl. grid styles) ──────────

function createFigmaMock() {
    let idCounter = 0;
    const collections: any[] = [];
    const variables: any[] = [];
    const effectStyles: any[] = [];
    const textStyles: any[] = [];
    const gridStyles: any[] = [];

    const figmaMock = {
        variables: {
            async getLocalVariableCollectionsAsync() { return collections; },
            async getLocalVariablesAsync(type?: string) {
                return type ? variables.filter(v => v.resolvedType === type) : variables;
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
                        const modeId = 'mode-' + (++idCounter);
                        col.modes.push({ name: name2, modeId });
                        return modeId;
                    },
                };
                collections.push(col);
                return col;
            },
            createVariable(name: string, collection: any, type: string) {
                const v: any = {
                    id: 'var-' + (++idCounter),
                    name,
                    variableCollectionId: collection.id,
                    resolvedType: type,
                    valuesByMode: {},
                    scopes: [],
                    codeSyntax: {},
                    setValueForMode(modeId: string, value: unknown) { v.valuesByMode[modeId] = value; },
                    setVariableCodeSyntax(platform: string, value: string) { v.codeSyntax[platform] = value; },
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
        async getLocalGridStylesAsync() { return gridStyles; },
        createGridStyle() {
            const s: any = { id: 'grid-' + (++idCounter), name: '', layoutGrids: [] };
            gridStyles.push(s);
            return s;
        },
        async loadFontAsync(_font: unknown) { /* fonts always available in mock */ },
    };

    return { figmaMock, collections, variables, effectStyles, textStyles, gridStyles };
}

const allCategoriesOn: Omit<ImportOptions, 'collectionName'> = {
    importColors: true, importSpacing: true, importRadius: true, importShadows: true,
    importBlur: true, importTypography: true, importBreakpoints: true,
    importContainers: true, importFontWeights: true, importTracking: true,
    importLeading: true, importMaxWidth: true, importBorderWidth: true,
    importOpacity: true, importSkew: true,
};

const ADAPTER_CONFIGS: Record<string, object> = {
    'shadcn': { baseColor: 'neutral', accent: 'blue' },
};

// Minimum variables each adapter must materialize in Figma for the import to
// count as successful (regression floor, not exact counts).
const MIN_VARIABLES: Record<string, number> = {
    'tailwindcss': 400,
    'shadcn': 30,
    'base-ui': 20,
    'coss': 10,
    'radix-colors': 700,
    'mui': 40,
    'chakra': 150,
    'mantine': 150,
    'daisyui': 15,
    'bootstrap': 40,
};

describe('full pipeline: every adapter imports successfully', () => {
    beforeEach(() => {
        clearCache();
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    });
    afterEach(() => {
        vi.unstubAllGlobals();
        delete (globalThis as Record<string, unknown>).figma;
    });

    for (const adapter of getAllAdapters()) {
        it(`${adapter.id}: fetch → parse → import creates variables (and is idempotent)`, async () => {
            const mock = createFigmaMock();
            (globalThis as Record<string, unknown>).figma = mock.figmaMock;

            const result = await adapter.fetchAndParse(ADAPTER_CONFIGS[adapter.id] as never);

            if (result.type === 'primitives') {
                await importPrimitives(result.tokens, { ...allCategoriesOn, collectionName: adapter.defaultCollectionName });
            } else {
                await importThemeTokens({
                    ...allCategoriesOn,
                    collectionName: adapter.defaultCollectionName,
                    primitiveCollectionName: 'TailwindCSS',
                    lightTokens: result.tokens.light,
                    darkTokens: result.tokens.dark,
                    extras: result.extras,
                });
            }

            expect(mock.variables.length, `${adapter.id} variables`).toBeGreaterThanOrEqual(MIN_VARIABLES[adapter.id]);
            expect(mock.collections.length).toBeGreaterThanOrEqual(1);

            // Theme adapters must produce true Light/Dark modes
            if (result.type === 'theme') {
                const col = mock.collections[0];
                expect(col.modes.map((m: any) => m.name)).toEqual(['Light', 'Dark']);
            }

            // Every created variable carries WEB code syntax
            const missingSyntax = mock.variables.filter(v => !v.codeSyntax['WEB']);
            expect(missingSyntax.map(v => v.name), `${adapter.id} missing code syntax`).toEqual([]);

            // Idempotence: run again, nothing duplicates
            const counts = {
                variables: mock.variables.length,
                collections: mock.collections.length,
                effects: mock.effectStyles.length,
                texts: mock.textStyles.length,
            };
            const result2 = await adapter.fetchAndParse(ADAPTER_CONFIGS[adapter.id] as never);
            if (result2.type === 'primitives') {
                await importPrimitives(result2.tokens, { ...allCategoriesOn, collectionName: adapter.defaultCollectionName });
            } else {
                await importThemeTokens({
                    ...allCategoriesOn,
                    collectionName: adapter.defaultCollectionName,
                    primitiveCollectionName: 'TailwindCSS',
                    lightTokens: result2.tokens.light,
                    darkTokens: result2.tokens.dark,
                    extras: result2.extras,
                });
            }
            expect(mock.variables.length, `${adapter.id} idempotence`).toBe(counts.variables);
            expect(mock.collections.length).toBe(counts.collections);
            expect(mock.effectStyles.length).toBe(counts.effects);
            expect(mock.textStyles.length).toBe(counts.texts);
        });
    }
});
