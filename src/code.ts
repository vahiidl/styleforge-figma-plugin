// ─── StyleForge, Main Thread Entry Point ────────────────────────────────────
// Runs in Figma's sandbox. Handles messages from the UI and delegates
// to the core engine for variable creation.

import { resolveAdapters } from './adapters/registry';
import type { PrimitiveResult, ThemeResult } from './adapters/types';
import { importPrimitives, importThemeTokens } from './core/figmaSync';
import type { UIMessage, ImportPayload } from './shared/messaging';
import { postToUI } from './shared/messaging';
import type { ParsedTokenSet } from './core/parser';

// ─── Show UI ─────────────────────────────────────────────────────────────────

figma.showUI(__html__, {
    width: 420,
    height: 600,
    themeColors: true,
    title: 'StyleForge',
});

// ─── Message Handler ─────────────────────────────────────────────────────────

figma.ui.onmessage = function (msg: UIMessage) {
    switch (msg.type) {
        case 'IMPORT_TOKENS':
            handleImport(msg.payload);
            break;

        case 'CLOSE':
            figma.closePlugin();
            break;
    }
};

// ─── Import ──────────────────────────────────────────────────────────────────

/**
 * Fetch tokens from GitHub, then import directly into Figma.
 * No preview step, goes straight from config to import.
 */
function handleImport(payload: ImportPayload): void {
    // Resolve all selected adapters and their dependencies
    var adapters = resolveAdapters(payload.adapterIds);
    // Sort adapters: TailwindCSS first, then others
    adapters.sort(function (a, b) {
        if (a.id === 'tailwindcss') return -1;
        if (b.id === 'tailwindcss') return 1;
        return 0;
    });
    var totalCreated = 0;

    postToUI({ type: 'IMPORT_PROGRESS', progress: { current: 0, total: 1, phase: 'Init', message: 'Starting import... This may take a few minutes. Please wait while we process hundreds of tokens.' } });

    var processAdapter = function (index: number): void {
        if (index >= adapters.length) {
            postToUI({ type: 'IMPORT_COMPLETE', totalCreated: totalCreated });
            return;
        }

        var adapter = adapters[index];

        adapter.fetchAndParse().then(function (result) {
            if (result.type === 'primitives') {
                var options = {
                    collectionName: adapter.defaultCollectionName,
                    importColors: payload.categories.indexOf('colors') >= 0,
                    importSpacing: payload.categories.indexOf('spacing') >= 0,
                    importRadius: payload.categories.indexOf('radius') >= 0,
                    importShadows: payload.categories.indexOf('shadows') >= 0,
                    importBlur: payload.categories.indexOf('blur') >= 0,
                    importTypography: payload.categories.indexOf('typography') >= 0,
                    importBreakpoints: payload.categories.indexOf('breakpoints') >= 0,
                    importContainers: payload.categories.indexOf('containers') >= 0,
                    importFontWeights: payload.categories.indexOf('fontWeights') >= 0,
                    importTracking: payload.categories.indexOf('tracking') >= 0,
                    importLeading: payload.categories.indexOf('leading') >= 0,
                    importMaxWidth: payload.categories.indexOf('maxWidth') >= 0,
                    importBorderWidth: payload.categories.indexOf('borderWidth') >= 0,
                    importOpacity: payload.categories.indexOf('opacity') >= 0,
                    importSkew: payload.categories.indexOf('skew') >= 0,
                };

                // importPrimitives is now async (font loading)
                importPrimitives(result.tokens, options, function (progress) {
                    postToUI({ type: 'IMPORT_PROGRESS', progress: progress });
                }).then(function () {
                    totalCreated += countPrimitiveTokens(result.tokens);
                    processAdapter(index + 1);
                }).catch(function (error) {
                    postToUI({
                        type: 'IMPORT_ERROR',
                        error: error instanceof Error ? error.message : 'Import failed',
                    });
                });
            } else if (result.type === 'theme') {
                var themeOptions = {
                    collectionName: payload.collectionName || adapter.defaultCollectionName,
                    lightTokens: result.tokens.light,
                    darkTokens: result.tokens.dark,
                    primitiveCollectionName: payload.primitiveCollectionName || 'TailwindCSS',
                    importColors: true,
                    importSpacing: false,
                    importRadius: false,
                    importShadows: false,
                    importBlur: false,
                    importTypography: false,
                    importBreakpoints: false,
                    importContainers: false,
                    importFontWeights: false,
                    importTracking: false,
                    importLeading: false,
                    importMaxWidth: false,
                    importBorderWidth: false,
                    importOpacity: false,
                    importSkew: false,
                };

                importThemeTokens(themeOptions, function (progress) {
                    postToUI({ type: 'IMPORT_PROGRESS', progress: progress });
                }).then(function () {
                    var allKeys = new Set(
                        Object.keys(result.tokens.light).concat(Object.keys(result.tokens.dark))
                    );
                    totalCreated += allKeys.size;
                    processAdapter(index + 1);
                }).catch(function (error) {
                    postToUI({
                        type: 'IMPORT_ERROR',
                        error: error instanceof Error ? error.message : 'Theme import failed',
                    });
                });
            }
        }).catch(function (error) {
            postToUI({
                type: 'IMPORT_ERROR',
                error: error instanceof Error ? error.message : 'Failed to fetch tokens',
            });
        });
    };

    processAdapter(0);
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
        tokens.opacity.length +
        tokens.skew.length
    );
}
