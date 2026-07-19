// ─── StyleForge, Main Thread Entry Point ────────────────────────────────────
// Runs in Figma's sandbox. Handles messages from the UI and delegates
// to the core engine for variable creation, diff preview and export.

import { resolveAdapters } from './adapters/registry';
import type { AdapterConfig } from './adapters/types';
import { importPrimitives, importThemeTokens, type ImportOptions } from './core/figmaSync';
import { diffCollection, planFromThemeTokens, type CollectionDiff, type ExistingVariableSnapshot } from './core/diffEngine';
import { toDtcg, toCss, type ExportedCollection } from './core/exporter';
import type { UIMessage, ImportPayload, AdapterSource } from './shared/messaging';
import { postToUI } from './shared/messaging';
import type { ParsedTokenSet } from './core/parser';
import type { FigmaColor } from './core/colorUtils';

// ─── Show UI ─────────────────────────────────────────────────────────────────

figma.showUI(__html__, {
    width: 420,
    height: 640,
    themeColors: true,
    title: 'StyleForge',
});

// ─── Plan capability detection ───────────────────────────────────────────────
// Free/Starter files allow only ONE mode per variable collection. Detect this
// up front so the UI can warn that Dark mode values will be skipped.

async function detectMultiModeSupport(): Promise<boolean> {
    try {
        // If any existing collection already has 2+ modes, the plan supports it.
        const collections = await figma.variables.getLocalVariableCollectionsAsync();
        if (collections.some(c => c.modes.length > 1)) return true;

        // Otherwise probe with a throwaway collection.
        const probe = figma.variables.createVariableCollection('__styleforge_probe__');
        try {
            probe.addMode('probe');
            return true;
        } catch (e) {
            return false;
        } finally {
            probe.remove();
        }
    } catch (e) {
        return true; // never block the import on detection failure
    }
}

detectMultiModeSupport().then(multiMode => {
    postToUI({ type: 'CAPABILITIES', multiMode });
});

// ─── Message Handler ─────────────────────────────────────────────────────────

figma.ui.onmessage = function (msg: UIMessage) {
    switch (msg.type) {
        case 'IMPORT_TOKENS':
            handleImport(msg.payload).catch(err => {
                postToUI({ type: 'IMPORT_ERROR', error: err instanceof Error ? err.message : 'Import failed' });
            });
            break;

        case 'REQUEST_DIFF':
            handleDiff(msg.payload).catch(err => {
                postToUI({ type: 'DIFF_ERROR', error: err instanceof Error ? err.message : 'Preview failed' });
            });
            break;

        case 'EXPORT_TOKENS':
            handleExport().catch(err => {
                postToUI({ type: 'EXPORT_ERROR', error: err instanceof Error ? err.message : 'Export failed' });
            });
            break;

        case 'CLOSE':
            figma.closePlugin();
            break;
    }
};

// ─── Shared plumbing ─────────────────────────────────────────────────────────

function optionsFromCategories(payload: ImportPayload, collectionName: string): ImportOptions {
    const has = (c: string) => payload.categories.indexOf(c as never) >= 0;
    return {
        collectionName,
        importColors: has('colors'),
        importSpacing: has('spacing'),
        importRadius: has('radius'),
        importShadows: has('shadows'),
        importBlur: has('blur'),
        importTypography: has('typography'),
        importBreakpoints: has('breakpoints'),
        importContainers: has('containers'),
        importFontWeights: has('fontWeights'),
        importTracking: has('tracking'),
        importLeading: has('leading'),
        importMaxWidth: has('maxWidth'),
        importBorderWidth: has('borderWidth'),
        importOpacity: has('opacity'),
        importSkew: has('skew'),
    };
}

function sortedAdapters(payload: ImportPayload) {
    const adapters = resolveAdapters(payload.adapterIds);
    adapters.sort(function (a, b) {
        if (a.id === 'tailwindcss') return -1;
        if (b.id === 'tailwindcss') return 1;
        return 0;
    });
    return adapters;
}

function configFor(payload: ImportPayload, adapterId: string): AdapterConfig | undefined {
    return payload.adapterConfigs ? payload.adapterConfigs[adapterId] : undefined;
}

// ─── Import ──────────────────────────────────────────────────────────────────

async function handleImport(payload: ImportPayload): Promise<void> {
    const adapters = sortedAdapters(payload);
    let totalCreated = 0;
    let modesLimited = false;
    const sources: AdapterSource[] = [];

    postToUI({
        type: 'IMPORT_PROGRESS',
        progress: { current: 0, total: 1, phase: 'Init', message: 'Starting import... This may take a few minutes for large palettes.' },
    });

    for (const adapter of adapters) {
        const result = await adapter.fetchAndParse(configFor(payload, adapter.id));
        sources.push({ adapterId: adapter.id, source: result.source });

        if (result.type === 'primitives') {
            const options = optionsFromCategories(payload, adapter.defaultCollectionName);
            await importPrimitives(result.tokens, options, progress => {
                postToUI({ type: 'IMPORT_PROGRESS', progress });
            });
            totalCreated += countPrimitiveTokens(result.tokens);
        } else {
            const themeOptions = {
                ...optionsFromCategories(payload, ''),
                collectionName:
                    adapters.filter(a => a.type === 'theme').length === 1 && payload.collectionName
                        ? payload.collectionName
                        : adapter.defaultCollectionName,
                lightTokens: result.tokens.light,
                darkTokens: result.tokens.dark,
                primitiveCollectionName: payload.primitiveCollectionName || 'TailwindCSS',
                extras: result.extras,
            };
            const info = await importThemeTokens(themeOptions, progress => {
                postToUI({ type: 'IMPORT_PROGRESS', progress });
            });
            if (info.modeLimited) modesLimited = true;
            const allKeys = new Set(
                Object.keys(result.tokens.light).concat(Object.keys(result.tokens.dark))
            );
            totalCreated += allKeys.size;
        }
    }

    postToUI({ type: 'IMPORT_COMPLETE', totalCreated, sources, modesLimited });
}

// ─── Diff Preview ────────────────────────────────────────────────────────────

async function snapshotCollection(name: string): Promise<ExistingVariableSnapshot[] | null> {
    const collections = await figma.variables.getLocalVariableCollectionsAsync();
    const collection = collections.find(c => c.name === name);
    if (!collection) return null;

    const allVars = await figma.variables.getLocalVariablesAsync();
    const vars = allVars.filter(v => v.variableCollectionId === collection.id);
    const modeNames: Record<string, string> = {};
    for (const m of collection.modes) modeNames[m.modeId] = m.name;

    return vars.map(v => {
        const values: ExistingVariableSnapshot['values'] = {};
        for (const [modeId, val] of Object.entries(v.valuesByMode)) {
            const modeName = modeNames[modeId] || modeId;
            if (val && typeof val === 'object' && 'type' in val && (val as VariableAlias).type === 'VARIABLE_ALIAS') {
                values[modeName] = null; // alias — compared as unset (import overwrites value)
            } else {
                values[modeName] = val as FigmaColor | number | string | boolean;
            }
        }
        return { name: v.name, resolvedType: v.resolvedType, values };
    });
}

async function handleDiff(payload: ImportPayload): Promise<void> {
    const adapters = sortedAdapters(payload);
    const diffs: CollectionDiff[] = [];
    const sources: AdapterSource[] = [];

    for (const adapter of adapters) {
        const result = await adapter.fetchAndParse(configFor(payload, adapter.id));
        sources.push({ adapterId: adapter.id, source: result.source });

        if (result.type === 'theme') {
            const collectionName =
                adapters.filter(a => a.type === 'theme').length === 1 && payload.collectionName
                    ? payload.collectionName
                    : adapter.defaultCollectionName;
            const planned = planFromThemeTokens(result.tokens.light, result.tokens.dark);
            const existing = await snapshotCollection(collectionName);
            diffs.push(diffCollection(collectionName, planned, existing));
        } else {
            // Primitive sets are large; diff on color names/values only.
            const collectionName = adapter.defaultCollectionName;
            const planned = result.tokens.colors.map(c => ({
                name: 'colors/' + c.path.join('/'),
                light: c.rawValue,
            }));
            const existing = await snapshotCollection(collectionName);
            diffs.push(diffCollection(collectionName, planned, existing));
        }
    }

    postToUI({ type: 'DIFF_RESULT', diffs, sources });
}

// ─── Export ──────────────────────────────────────────────────────────────────

async function handleExport(): Promise<void> {
    const collections = await figma.variables.getLocalVariableCollectionsAsync();
    if (collections.length === 0) {
        postToUI({ type: 'EXPORT_ERROR', error: 'No local variable collections found in this file.' });
        return;
    }
    const allVars = await figma.variables.getLocalVariablesAsync();

    const exported: ExportedCollection[] = [];
    for (const collection of collections) {
        const modeNames: Record<string, string> = {};
        for (const m of collection.modes) modeNames[m.modeId] = m.name;
        const vars = allVars.filter(v => v.variableCollectionId === collection.id);

        exported.push({
            name: collection.name,
            modes: collection.modes.map(m => m.name),
            variables: vars.map(v => {
                const values: Record<string, FigmaColor | number | string | boolean | null> = {};
                for (const [modeId, val] of Object.entries(v.valuesByMode)) {
                    const modeName = modeNames[modeId] || modeId;
                    if (val && typeof val === 'object' && 'type' in val && (val as VariableAlias).type === 'VARIABLE_ALIAS') {
                        // resolve one level of alias to its value in the same mode
                        const target = allVars.find(t => t.id === (val as VariableAlias).id);
                        const targetVal = target ? Object.values(target.valuesByMode)[0] : null;
                        values[modeName] = (targetVal && typeof targetVal === 'object' && 'type' in targetVal)
                            ? null
                            : (targetVal as FigmaColor | number | string | boolean | null);
                    } else {
                        values[modeName] = val as FigmaColor | number | string | boolean;
                    }
                }
                return { name: v.name, type: v.resolvedType, values };
            }),
        });
    }

    postToUI({ type: 'EXPORT_RESULT', json: toDtcg(exported), css: toCss(exported) });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function countPrimitiveTokens(tokens: ParsedTokenSet): number {
    return (
        tokens.colors.length +
        tokens.spacing.length +
        tokens.radius.length +
        tokens.shadows.length +
        tokens.blur.length +
        tokens.typography.length +
        tokens.opacity.length +
        tokens.breakpoints.length +
        tokens.containers.length +
        tokens.fontWeights.length +
        tokens.tracking.length +
        tokens.leading.length +
        tokens.maxWidth.length +
        tokens.borderWidth.length +
        tokens.skew.length
    );
}
