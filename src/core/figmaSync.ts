// ─── Figma Sync Engine ───────────────────────────────────────────────────────
// Orchestrates the full import pipeline: takes parsed tokens and creates
// Figma Variables (with scopes), Effect Styles, and Text Styles.

import type { ParsedTokenSet, ParsedColor, ParsedFloat, ParsedShadow, ParsedTypography, ParsedFont } from './parser';
import type { FigmaColor } from './colorUtils';
import { parseColorValue } from './colorUtils';
import { parseDimension } from './colorUtils';
import { parseShadowValue } from './parser';
import type { ThemeExtras } from '../adapters/types';
import {
    findOrCreateCollection,
    setCodeSyntax,
    ensureModes,
    setColorVariable,
    setFloatVariable,
    setStringVariable,
    setVariableAlias,
    findOrCreateVariable,
    getVariablesInCollection,
    resolveColorAlias,
    type CollectionInfo,
} from './variableManager';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ImportOptions {
    collectionName: string;
    importColors: boolean;
    importSpacing: boolean;
    importRadius: boolean;
    importShadows: boolean;
    importBlur: boolean;
    importTypography: boolean;
    importBreakpoints: boolean;
    importContainers: boolean;
    importFontWeights: boolean;
    importTracking: boolean;
    importLeading: boolean;
    importMaxWidth: boolean;
    importBorderWidth: boolean;
    importOpacity: boolean;
    importSkew: boolean;
}

export interface ThemeImportOptions extends ImportOptions {
    lightTokens: Record<string, string>;
    darkTokens: Record<string, string>;
    primitiveCollectionName: string;
    /** Extra non-color outputs (floats, strings, state colors, shadow/text styles). */
    extras?: ThemeExtras;
    /** CSS custom-property prefix for code syntax, e.g. '' → var(--primary). */
    codeSyntaxPrefix?: string;
}

export interface ImportProgress {
    current: number;
    total: number;
    phase: string;
    message: string;
}

export type ProgressCallback = (progress: ImportProgress) => void;

// ─── Scope Helpers ───────────────────────────────────────────────────────────

/**
 * Apply Figma variable scopes so variables only appear in relevant UI pickers.
 */
function applyScopes(variable: Variable, scopes: VariableScope[]): void {
    variable.scopes = scopes;
}

function mapFontFamily(fontFamily: string): string {
    if (fontFamily === 'ui-sans-serif' || fontFamily === 'system-ui') return 'Inter';
    if (fontFamily === 'ui-serif') return 'Georgia';
    if (fontFamily === 'ui-monospace') return 'Roboto Mono';
    return fontFamily;
}

// ─── Primitive Collection Import ─────────────────────────────────────────────

/**
 * Import primitive tokens into a single-mode collection.
 * Async because Text Styles require font loading.
 */
export async function importPrimitives(
    tokens: ParsedTokenSet,
    options: ImportOptions,
    onProgress?: ProgressCallback
): Promise<CollectionInfo> {
    var total = countTokens(tokens, options);
    var current = 0;

    var info = await findOrCreateCollection(options.collectionName);
    var modeId = Object.values(info.modeIds)[0];

    // ── Pre-process Fonts & Weights (Needed for Text Styles) ──
    // We create variables for them first so we can bind them.

    let defaultFontFamilyVar: Variable | undefined;
    if (options.importTypography && tokens.fonts) {
        for (const font of tokens.fonts) {
            const name = 'typography/family/' + font.name;
            const mappedFamily = mapFontFamily(font.family);
            const v = await setStringVariable(info.collection, modeId, name, mappedFamily);
            applyScopes(v, ['FONT_FAMILY'] as VariableScope[]);
            setCodeSyntax(v, 'var(--font-' + font.name + ')');
            if (font.name === 'sans') defaultFontFamilyVar = v;
        }
    }

    let defaultFontWeightVar: Variable | undefined;
    if (options.importFontWeights) {
        onProgress && onProgress({ current: current, total: total, phase: 'Font Weights', message: 'Importing font weights...' });
        for (const fw of tokens.fontWeights) {
            const name = 'typography/weight/' + fw.path.join('/');
            const v = await setFloatVariable(info.collection, modeId, name, fw.value);
            applyScopes(v, ['FONT_WEIGHT'] as VariableScope[]);
            setCodeSyntax(v, 'var(--font-weight-' + fw.path.join('-') + ')');
            if (fw.path.includes('normal') || fw.value === 400) defaultFontWeightVar = v;
            current++;
        }
    }

    // Fallbacks if defaults not found
    if (!defaultFontFamilyVar && tokens.fonts && tokens.fonts.length > 0) {
        // Try finding existing variable if we didn't just create it (unlikely path but safe)
        // Or just create a default one? 
        // For now, if 'sans' missing, we might not have a variable to bind to.
    }

    // ── Colors ──
    if (options.importColors) {
        onProgress && onProgress({ current: current, total: total, phase: 'Colors', message: 'Importing colors...' });
        for (var i = 0; i < tokens.colors.length; i++) {
            var color = tokens.colors[i];
            var name = 'colors/' + color.path.join('/');
            var v = await setColorVariable(info.collection, modeId, name, color.figmaColor);
            applyScopes(v, ['ALL_FILLS', 'STROKE_COLOR', 'EFFECT_COLOR'] as VariableScope[]);
            setCodeSyntax(v, 'var(--color-' + color.path.join('-') + ')');
            current++;
            if (current % 20 === 0) {
                onProgress && onProgress({ current: current, total: total, phase: 'Colors', message: 'Colors: ' + current + '/' + total });
            }
        }
    }

    // ── Spacing ──
    if (options.importSpacing) {
        onProgress && onProgress({ current: current, total: total, phase: 'Spacing', message: 'Importing spacing...' });
        for (var i = 0; i < tokens.spacing.length; i++) {
            var sp = tokens.spacing[i];
            var name = 'spacing/' + sp.path.join('/');
            var v = await setFloatVariable(info.collection, modeId, name, sp.value);
            applyScopes(v, ['GAP', 'WIDTH_HEIGHT', 'PARAGRAPH_SPACING'] as VariableScope[]);
            setCodeSyntax(v, 'var(--spacing-' + sp.path.join('-') + ')');
            current++;
        }
    }

    // ── Radius ──
    if (options.importRadius) {
        onProgress && onProgress({ current: current, total: total, phase: 'Radius', message: 'Importing radius...' });
        for (var i = 0; i < tokens.radius.length; i++) {
            var rad = tokens.radius[i];
            var name = 'radius/' + rad.path.join('/');
            var v = await setFloatVariable(info.collection, modeId, name, rad.value);
            applyScopes(v, ['CORNER_RADIUS'] as VariableScope[]);
            setCodeSyntax(v, 'var(--radius-' + rad.path.join('-') + ')');
            current++;
        }
    }

    // ── Blur (Variables & Styles) ──
    if (options.importBlur) {
        onProgress && onProgress({ current: current, total: total, phase: 'Blur', message: 'Importing blur...' });
        // Layer Blur
        for (var i = 0; i < tokens.blur.length; i++) {
            var bl = tokens.blur[i];
            var name = 'blur/' + bl.path.join('/');
            var v = await setFloatVariable(info.collection, modeId, name, bl.value);
            applyScopes(v, ['EFFECT_FLOAT'] as VariableScope[]);
            setCodeSyntax(v, 'var(--blur-' + bl.path.join('-') + ')');

            // Create Effect Style
            await createBlurStyle(name, bl.value, false, v); // isBackdrop = false
            current++;
        }

        // Backdrop Blur (Background Blur) derived from standard Blur tokens
        // User requested backdrop-blur styles to be generated even if explicit tokens are missing,
        // using the same scale as standard blur.
        for (var i = 0; i < tokens.blur.length; i++) {
            var bl = tokens.blur[i];
            // Name: backdrop-blur/xs, etc.
            var name = 'backdrop-blur/' + bl.path.join('/');

            // Create Variable for it? Or reuse blur variable?
            // User screenshot shows defaults.
            // We can create a SEPARATE variable group for backdrop-blur if we want, or just bind to blur variables.
            // But since we are iterating tokens.blur, we might not have unique backdrop-blur tokens.
            // We'll create the STYLE.
            // Optional: Create specific variable `backdrop-blur/xs` -> value 4.
            // Check if variable already exists (from tokens.backdropBlur)?
            // If tokens.backdropBlur is empty, we create it here.
            // If we inject it, it's better. 
            // BUT simpler: just create the STYLE and bind it to the `blur/xs` variable?
            // Or create a new variable `backdrop-blur/xs`.

            const variableName = 'backdrop-blur/' + bl.path.join('/');
            const v = await setFloatVariable(info.collection, modeId, variableName, bl.value);
            applyScopes(v, ['EFFECT_FLOAT'] as VariableScope[]);
            setCodeSyntax(v, 'var(--backdrop-blur-' + bl.path.join('-') + ')');

            await createBlurStyle(variableName, bl.value, true, v);
        }

        // Also process explicit backdrop tokens if any (and avoid duplicates?)
        if (tokens.backdropBlur && tokens.backdropBlur.length > 0) {
            // If we already processed them via 'blur' loop (if names overlap), we might duplicate.
            // But tokens.blur usually has 'xs', 'sm'. tokens.backdropBlur usually has 'xs', 'sm'.
            // If they are identical, we just overwrote them. That's fine.
            for (const bb of tokens.backdropBlur) {
                const name = 'backdrop-blur/' + bb.path.join('/');
                const v = await setFloatVariable(info.collection, modeId, name, bb.value);
                applyScopes(v, ['EFFECT_FLOAT'] as VariableScope[]);
                setCodeSyntax(v, 'var(--backdrop-blur-' + bb.path.join('-') + ')');
                await createBlurStyle(name, bb.value, true, v);
            }
        }
    }

    // ── Opacity ──
    if (tokens.opacity.length > 0) {
        onProgress && onProgress({ current: current, total: total, phase: 'Opacity', message: 'Importing opacity...' });
        for (var i = 0; i < tokens.opacity.length; i++) {
            var op = tokens.opacity[i];
            var name = 'opacity/' + op.path.join('/');
            var v = await setFloatVariable(info.collection, modeId, name, op.value);
            applyScopes(v, ['OPACITY'] as VariableScope[]);
            setCodeSyntax(v, 'var(--opacity-' + op.path.join('-') + ')');
            current++;
        }
    }

    // ── Breakpoints ──
    if (options.importBreakpoints) {
        onProgress && onProgress({ current: current, total: total, phase: 'Breakpoints', message: 'Importing breakpoints...' });
        for (var i = 0; i < tokens.breakpoints.length; i++) {
            var bp = tokens.breakpoints[i];
            var name = 'breakpoint/' + bp.path.join('/');
            var v = await setFloatVariable(info.collection, modeId, name, bp.value);
            applyScopes(v, ['WIDTH_HEIGHT'] as VariableScope[]);
            setCodeSyntax(v, 'var(--breakpoint-' + bp.path.join('-') + ')');
            current++;
        }
    }

    // ── Containers ──
    if (options.importContainers) {
        onProgress && onProgress({ current: current, total: total, phase: 'Containers', message: 'Importing containers...' });
        for (var i = 0; i < tokens.containers.length; i++) {
            var cont = tokens.containers[i];
            var name = 'container/' + cont.path.join('/');
            var v = await setFloatVariable(info.collection, modeId, name, cont.value);
            applyScopes(v, ['WIDTH_HEIGHT'] as VariableScope[]);
            setCodeSyntax(v, 'var(--container-' + cont.path.join('-') + ')');
            current++;
        }
    }

    // ── Tracking (Letter Spacing) ──
    let trackingVars: Record<string, Variable> = {};
    if (options.importTracking) {
        onProgress && onProgress({ current: current, total: total, phase: 'Tracking', message: 'Importing tracking...' });
        for (var i = 0; i < tokens.tracking.length; i++) {
            var tr = tokens.tracking[i];
            var name = 'typography/tracking/' + tr.path.join('/');
            var v = await setFloatVariable(info.collection, modeId, name, tr.value);
            applyScopes(v, ['LETTER_SPACING'] as VariableScope[]);
            setCodeSyntax(v, 'var(--tracking-' + tr.path.join('-') + ')');
            // Store for binding if needed (though text styles usually don't map 1:1 to these unless specifically requested)
            current++;
        }
    }

    // ── Leading (Line Height) ──
    if (options.importLeading) {
        onProgress && onProgress({ current: current, total: total, phase: 'Leading', message: 'Importing leading...' });
        for (var i = 0; i < tokens.leading.length; i++) {
            var ld = tokens.leading[i];

            // Phase 20: Remove specific named leading variables
            const ignore = ['tight', 'snug', 'normal', 'relaxed', 'loose'];
            if (ignore.includes(ld.path[0])) continue;

            var name = 'typography/leading/' + ld.path.join('/');
            var v = await setFloatVariable(info.collection, modeId, name, ld.value);
            applyScopes(v, ['LINE_HEIGHT'] as VariableScope[]);
            setCodeSyntax(v, 'var(--leading-' + ld.path.join('-') + ')');
            current++;
        }
    }

    // ── Max Width (Grid Styles) ──
    if (options.importMaxWidth && tokens.maxWidth) {
        onProgress && onProgress({ current: current, total: total, phase: 'Max Width', message: 'Importing max-width grids...' });
        for (const mw of tokens.maxWidth) {
            const name = 'max-width/' + mw.path.join('/');
            await createGridStyle(name, mw.value);
            current++;
        }
    }

    // ── Border Width ──
    if (options.importBorderWidth && tokens.borderWidth) {
        onProgress && onProgress({ current: current, total: total, phase: 'Border Width', message: 'Importing border width...' });
        for (const bw of tokens.borderWidth) {
            const name = 'border-width/' + bw.path.join('/');
            const v = await setFloatVariable(info.collection, modeId, name, bw.value);
            applyScopes(v, ['STROKE_FLOAT'] as VariableScope[]);
            setCodeSyntax(v, 'var(--border-width-' + bw.path.join('-') + ')');
            current++;
        }
    }

    // ── Opacity ──
    if (options.importOpacity && tokens.opacity) {
        onProgress && onProgress({ current: current, total: total, phase: 'Opacity', message: 'Importing opacity...' });
        for (const op of tokens.opacity) {
            const name = 'opacity/' + op.path.join('/');
            // Opacity in CSS is 0-1, but Figma API expects 0-1?
            // User requested name "0", value "0". Name "100", value "100"?
            // If parser returns raw value from Tailwind (e.g. 0.5), we import it as is.
            // If user wants 0-100 integers, we might need conversion.
            // But Tailwind opacity-50 is 0.5.
            // User screenshot shows value "0.5" for "0-5"? And "1", "2", "3" for others?
            // Wait, screenshot shows "0-5" -> 0.5? And "1" -> 1?
            // Typically opacity is 0-1 float.
            // If user provided custom values like 0, 1, 2... 100, then they are integers.
            // I will respect the parsed value from parser.
            const v = await setFloatVariable(info.collection, modeId, name, op.value);
            applyScopes(v, ['OPACITY'] as VariableScope[]);
            setCodeSyntax(v, 'var(--opacity-' + op.path.join('-') + ')');
            current++;
        }
    }

    // ── Skew ──
    if (options.importSkew && tokens.skew) {
        onProgress && onProgress({ current: current, total: total, phase: 'Skew', message: 'Importing skew...' });
        for (const sk of tokens.skew) {
            const name = 'skew/' + sk.path.join('/');
            const v = await setFloatVariable(info.collection, modeId, name, sk.value);
            // Explicitly remove all scopes as requested (skew has no scopes)
            applyScopes(v, []);
            setCodeSyntax(v, 'var(--skew-' + sk.path.join('-') + ')');
            current++;
        }
    }

    // ── Typography (Float Variables + Text Styles with variable binding) ──
    if (options.importTypography) {
        onProgress && onProgress({ current: current, total: total, phase: 'Typography', message: 'Importing typography...' });
        for (var i = 0; i < tokens.typography.length; i++) {
            var typo = tokens.typography[i];

            // 1. Create Font Size Variable
            var sizeVarName = 'typography/size/' + typo.name;
            var sizeVar = await setFloatVariable(info.collection, modeId, sizeVarName, typo.fontSize);
            applyScopes(sizeVar, ['FONT_SIZE'] as VariableScope[]);
            setCodeSyntax(sizeVar, 'var(--text-' + typo.name + ')');

            // 2. Create Line Height Variable (Specific to this text style)
            // We calculate the pixel value for the variable to match our logic
            let lineHeightPx = typo.lineHeight || (typo.fontSize * 1.5);
            // Convert multiplier to px if small
            if (lineHeightPx < 4) {
                lineHeightPx = typo.fontSize * lineHeightPx;
            }

            var lhVarName = 'typography/leading/' + typo.name;
            var lhVar = await setFloatVariable(info.collection, modeId, lhVarName, lineHeightPx);
            applyScopes(lhVar, ['LINE_HEIGHT'] as VariableScope[]);
            setCodeSyntax(lhVar, 'var(--text-' + typo.name + '--line-height)');

            // 3. Create Letter Spacing Variable
            // Check if letterSpacing is defined; if not, default to 0 (per user check)
            var lsVarName = 'typography/letter-spacing/' + typo.name;
            var lsValue = typo.letterSpacing !== undefined ? typo.letterSpacing : 0;

            // Use 'typography/tracking/normal' (0) if default
            let lsVar: Variable | undefined;
            if (typo.letterSpacing !== undefined) {
                var lsVarName = 'typography/letter-spacing/' + typo.name;
                lsVar = await setFloatVariable(info.collection, modeId, lsVarName, lsValue);
            } else {
                var normalName = 'typography/tracking/normal';
                lsVar = await setFloatVariable(info.collection, modeId, normalName, 0);
            }
            applyScopes(lsVar, ['LETTER_SPACING'] as VariableScope[]);
            setCodeSyntax(lsVar, 'var(--text-' + typo.name + '--letter-spacing)');

            // 4. Create Text Style & Bind
            // Use 'Inter' as default family string if variable missing
            const familyName = defaultFontFamilyVar ? (defaultFontFamilyVar.valuesByMode[modeId] as string) : 'Inter';

            // 4. Create Text Styles (Size x Weight Matrix)
            if (options.importFontWeights && tokens.fontWeights && tokens.fontWeights.length > 0) {
                // Generate all weights for this size
                for (const fw of tokens.fontWeights) {
                    const weightName = fw.path.join('/');
                    const styleName = 'text-' + typo.name + '/' + weightName;

                    // Find specific variable for this weight
                    const wName = 'typography/weight/' + weightName;
                    const wVar = await setFloatVariable(info.collection, modeId, wName, fw.value);
                    setCodeSyntax(wVar, 'var(--font-weight-' + weightName + ')');

                    // Clone typo and override weight for this specific style
                    const specificTypo = { ...typo, fontWeight: fw.value };

                    await createTextStyle(
                        styleName,
                        specificTypo,
                        familyName,
                        sizeVar,
                        lhVar,
                        lsVar,
                        defaultFontFamilyVar,
                        wVar
                    );
                }
            } else {
                // Fallback: Create single style (original behavior)
                let specificWeightVar = defaultFontWeightVar;
                if (options.importFontWeights && tokens.fontWeights && typo.fontWeight) {
                    const match = tokens.fontWeights.find(fw => fw.value === typo.fontWeight);
                    if (match) {
                        const wName = 'typography/weight/' + match.path.join('/');
                        specificWeightVar = await setFloatVariable(info.collection, modeId, wName, match.value);
                        setCodeSyntax(specificWeightVar, 'var(--font-weight-' + match.path.join('-') + ')');
                    }
                }

                await createTextStyle(
                    'text-' + typo.name,
                    typo,
                    familyName,
                    sizeVar,
                    lhVar,
                    lsVar,
                    defaultFontFamilyVar,
                    specificWeightVar
                );
            }
            current++;
        }

        // Count fonts as processed
        if (tokens.fonts) current += tokens.fonts.length;
    }

    // ── Shadows (Effect Styles) ──
    if (options.importShadows) {
        onProgress && onProgress({ current: current, total: total, phase: 'Shadows', message: 'Importing shadows...' });
        for (var i = 0; i < tokens.shadows.length; i++) {
            var shadow = tokens.shadows[i];
            await createShadowStyle(shadow.name, shadow);
            current++;
        }
    }

    onProgress && onProgress({ current: total, total: total, phase: 'Done', message: 'Import complete!' });
    return info;
}

// ─── Theme Collection Import (Light/Dark with Aliases) ───────────────────────

export async function importThemeTokens(
    options: ThemeImportOptions,
    onProgress?: ProgressCallback
): Promise<CollectionInfo> {
    var allKeys = new Set([
        ...Object.keys(options.lightTokens),
        ...Object.keys(options.darkTokens),
    ]);
    var total = allKeys.size;
    var current = 0;

    var info = await findOrCreateCollection(options.collectionName);
    info = ensureModes(info, ['Light', 'Dark']);
    var lightModeId = info.modeIds['Light'];
    // undefined on Free/Starter files (1-mode plan limit) — dark values are skipped.
    var darkModeId: string | undefined = info.modeIds['Dark'];

    const allCollections = await figma.variables.getLocalVariableCollectionsAsync();
    var primitiveCollections = allCollections
        .find(function (c: VariableCollection) { return c.name === options.primitiveCollectionName; });

    var primitiveVars: Variable[] = [];
    var primitiveModeId = '';
    if (primitiveCollections) {
        primitiveVars = await getVariablesInCollection(primitiveCollections.id);
        if (primitiveCollections.modes.length > 0) {
            primitiveModeId = primitiveCollections.modes[0].modeId;
        }
    }

    onProgress && onProgress({ current: current, total: total, phase: 'Theme', message: 'Importing theme tokens...' });

    var keysArray = Array.from(allKeys);
    for (var i = 0; i < keysArray.length; i++) {
        var key = keysArray[i];
        var cleanName = key.replace(/^--/, '');
        var lightValue = options.lightTokens[key];
        var darkValue = options.darkTokens[key];

        var lightColor = lightValue ? parseColorValue(lightValue) : null;
        var darkColor = darkValue ? parseColorValue(darkValue) : null;

        if (lightColor || darkColor) {
            var variable = await findOrCreateVariable(info.collection, cleanName, 'COLOR');
            applyScopes(variable, ['ALL_FILLS', 'STROKE_COLOR', 'EFFECT_COLOR'] as VariableScope[]);
            setCodeSyntax(variable, 'var(--' + cleanName + ')');

            if (lightColor) {
                var alias = resolveColorAlias(lightColor, primitiveVars, primitiveModeId);
                if (alias) {
                    setVariableAlias(variable, lightModeId, alias);
                } else {
                    variable.setValueForMode(lightModeId, lightColor);
                }
            }

            if (darkColor && darkModeId) {
                var alias = resolveColorAlias(darkColor, primitiveVars, primitiveModeId);
                if (alias) {
                    setVariableAlias(variable, darkModeId, alias);
                } else {
                    variable.setValueForMode(darkModeId, darkColor);
                }
            }
        }

        // ── Non-color theme tokens (dimensions like `radius`) ──
        if (!lightColor && !darkColor) {
            var dimSource = lightValue || darkValue;
            var dim = dimSource ? parseDimension(dimSource) : null;
            if (dim !== null) {
                var fv = await findOrCreateVariable(info.collection, cleanName, 'FLOAT');
                var isRadius = cleanName.indexOf('radius') >= 0;
                applyScopes(fv, (isRadius ? ['CORNER_RADIUS'] : ['GAP', 'WIDTH_HEIGHT']) as VariableScope[]);
                setCodeSyntax(fv, 'var(--' + cleanName + ')');
                var lightDim = lightValue ? parseDimension(lightValue) : null;
                var darkDim = darkValue ? parseDimension(darkValue) : null;
                fv.setValueForMode(lightModeId, lightDim !== null ? lightDim : dim);
                if (darkModeId) fv.setValueForMode(darkModeId, darkDim !== null ? darkDim : dim);

                // shadcn derived radius scale: sm..4xl from the base --radius
                if (cleanName === 'radius') {
                    var scaleDefs: [string, number][] = [
                        ['radius-sm', 0.6], ['radius-md', 0.8], ['radius-lg', 1],
                        ['radius-xl', 1.4], ['radius-2xl', 1.8], ['radius-3xl', 2.2], ['radius-4xl', 2.6],
                    ];
                    for (var sd = 0; sd < scaleDefs.length; sd++) {
                        var sv = await findOrCreateVariable(info.collection, scaleDefs[sd][0], 'FLOAT');
                        applyScopes(sv, ['CORNER_RADIUS'] as VariableScope[]);
                        setCodeSyntax(sv, 'var(--' + scaleDefs[sd][0] + ')');
                        var scaled = Math.round(dim * scaleDefs[sd][1] * 100) / 100;
                        sv.setValueForMode(lightModeId, scaled);
                        if (darkModeId) sv.setValueForMode(darkModeId, scaled);
                    }
                }
            }
        }

        current++;
        if (current % 10 === 0) {
            onProgress && onProgress({ current: current, total: total, phase: 'Theme', message: 'Theme: ' + current + '/' + total });
        }
    }

    // ── Extras: floats, strings, state colors, shadow & text styles ──
    if (options.extras) {
        var ex = options.extras;
        if (ex.floats) {
            for (const f of ex.floats) {
                const fv2 = await findOrCreateVariable(info.collection, f.name, 'FLOAT');
                applyScopes(fv2, f.scopes as VariableScope[]);
                if (f.codeSyntax) setCodeSyntax(fv2, f.codeSyntax);
                fv2.setValueForMode(lightModeId, f.value);
                if (darkModeId) fv2.setValueForMode(darkModeId, f.value);
            }
        }
        if (ex.strings) {
            for (const st of ex.strings) {
                const sv2 = await findOrCreateVariable(info.collection, st.name, 'STRING');
                applyScopes(sv2, st.scopes as VariableScope[]);
                if (st.codeSyntax) setCodeSyntax(sv2, st.codeSyntax);
                sv2.setValueForMode(lightModeId, st.value);
                if (darkModeId) sv2.setValueForMode(darkModeId, st.value);
            }
        }
        if (ex.stateColors) {
            for (const sc of ex.stateColors) {
                const lightC = parseColorValue(sc.light);
                const darkC = parseColorValue(sc.dark);
                if (!lightC && !darkC) continue;
                const cv = await findOrCreateVariable(info.collection, sc.name, 'COLOR');
                applyScopes(cv, (sc.scopes || ['ALL_FILLS', 'STROKE_COLOR']) as VariableScope[]);
                if (sc.codeSyntax) setCodeSyntax(cv, sc.codeSyntax);
                if (lightC) cv.setValueForMode(lightModeId, lightC);
                if (darkC && darkModeId) cv.setValueForMode(darkModeId, darkC);
            }
        }
        if (ex.shadows) {
            for (const sh of ex.shadows) {
                const layers = parseShadowValue(sh.value);
                if (layers.length > 0) {
                    await createShadowStyle(sh.name, { name: sh.name, shadows: layers, rawValue: sh.value });
                }
            }
        }
        if (ex.textStyles) {
            for (const ts of ex.textStyles) {
                await createSimpleTextStyle(ts);
            }
        }
    }

    onProgress && onProgress({ current: total, total: total, phase: 'Done', message: 'Theme import complete!' });
    return info;
}

// ─── Simple (unbound) Text Style Creation ────────────────────────────────────

const WEIGHT_STYLES: Record<number, string> = {
    100: 'Thin', 200: 'Extra Light', 300: 'Light', 400: 'Regular',
    500: 'Medium', 600: 'Semi Bold', 700: 'Bold', 800: 'Extra Bold', 900: 'Black',
};

export async function createSimpleTextStyle(ts: {
    name: string; family?: string; fontSize: number;
    fontWeight?: number; lineHeight?: number; letterSpacing?: number;
}): Promise<void> {
    var family = mapFontFamily(ts.family || 'Inter');
    var styleName = WEIGHT_STYLES[ts.fontWeight || 400] || 'Regular';
    var fontName = { family: family, style: styleName };
    try {
        await figma.loadFontAsync(fontName);
    } catch (e) {
        fontName = { family: 'Inter', style: WEIGHT_STYLES[ts.fontWeight || 400] || 'Regular' };
        try { await figma.loadFontAsync(fontName); }
        catch (e2) {
            fontName = { family: 'Inter', style: 'Regular' };
            try { await figma.loadFontAsync(fontName); } catch (e3) { return; }
        }
    }
    var existing = (await figma.getLocalTextStylesAsync()).find(function (s: TextStyle) { return s.name === ts.name; });
    var style = existing || figma.createTextStyle();
    style.name = ts.name;
    style.fontName = fontName;
    style.fontSize = ts.fontSize;
    if (ts.lineHeight !== undefined && ts.lineHeight > 0) {
        var lh = ts.lineHeight < 4 ? ts.fontSize * ts.lineHeight : ts.lineHeight;
        style.lineHeight = { value: lh, unit: 'PIXELS' };
    }
    if (ts.letterSpacing !== undefined) {
        style.letterSpacing = { value: ts.letterSpacing, unit: 'PIXELS' };
    }
}

// ─── Text Style Creation ─────────────────────────────────────────────────────



/**
 * Create or update a Figma TextStyle with variables bound.
 */
async function createTextStyle(
    name: string,
    typo: ParsedTypography,
    fontFamily: string,
    fontSizeVariable: Variable,
    lineHeightVariable: Variable,
    letterSpacingVariable?: Variable,
    fontFamilyVariable?: Variable,
    fontWeightVariable?: Variable
): Promise<void> {
    var figmaFont = mapFontFamily(fontFamily);
    var fontName = { family: figmaFont, style: 'Regular' };

    // Load the font before modifying the text style
    try {
        await figma.loadFontAsync(fontName);
    } catch (e) {
        fontName = { family: 'Inter', style: 'Regular' };
        try {
            await figma.loadFontAsync(fontName);
        } catch (e2) {
            return; // Neither font available, skip
        }
    }

    var existing = (await figma.getLocalTextStylesAsync()).find(function (s: TextStyle) { return s.name === name; });
    var style = existing || figma.createTextStyle();
    style.name = name;
    style.fontName = fontName;
    style.fontSize = typo.fontSize;

    // Set Style Values (PIXELS) - Do this BEFORE binding
    // If we bind first, then set value, it might break binding or vice versa depending on API version.
    // Setting value explicitly is good fallback.

    // Line Height
    if (typo.lineHeight !== undefined && typo.lineHeight > 0) {
        if (typo.lineHeight < 4) {
            style.lineHeight = { value: typo.fontSize * typo.lineHeight, unit: 'PIXELS' };
        } else {
            style.lineHeight = { value: typo.lineHeight, unit: 'PIXELS' };
        }
    }

    // Letter Spacing
    if (typo.letterSpacing !== undefined) {
        style.letterSpacing = { value: typo.letterSpacing, unit: 'PIXELS' };
    }

    // Bind Variables
    try {
        // Font Size
        style.setBoundVariable('fontSize', fontSizeVariable);

        // Line Height
        style.setBoundVariable('lineHeight', lineHeightVariable);

        // Font Family
        if (fontFamilyVariable) {
            style.setBoundVariable('fontFamily', fontFamilyVariable);
        }

        // Font Weight
        if (fontWeightVariable) {
            style.setBoundVariable('fontWeight', fontWeightVariable);
        } else {
            // Try to bind to font-weight variables if implicit?
            // Or if typo.fontWeight matches one of our variables (e.g. 700 -> bold)
            // But we passed fontWeightVariable to function if it was found.
            // We need to ensure we FIND it in calling loop.
        }

        // Letter Spacing
        if (letterSpacingVariable) {
            style.setBoundVariable('letterSpacing', letterSpacingVariable);
        }

    } catch (e) {
        // Binding usually fails if variable type doesn't match or feature not supported in context
        // console.warn('Binding failed', e);
    }
}

// ─── Effect Style Creation ───────────────────────────────────────────────────

async function createShadowStyle(name: string, shadow: ParsedShadow): Promise<void> {
    const allEffectStyles = await figma.getLocalEffectStylesAsync();
    var existing = allEffectStyles.find(function (s: EffectStyle) { return s.name === name; });
    var style = existing || figma.createEffectStyle();
    style.name = name;

    style.effects = shadow.shadows.map(function (layer) {
        return {
            type: layer.type,
            color: { r: layer.color.r, g: layer.color.g, b: layer.color.b, a: layer.color.a },
            offset: { x: layer.x, y: layer.y },
            radius: layer.blur,
            spread: layer.spread,
            visible: true,
            blendMode: 'NORMAL' as BlendMode,
        };
    });
}

async function createBlurStyle(name: string, radius: number, isBackdrop: boolean, variable?: Variable): Promise<void> {
    const allEffectStyles = await figma.getLocalEffectStylesAsync();
    var existing = allEffectStyles.find(function (s: EffectStyle) { return s.name === name; });
    var style = existing || figma.createEffectStyle();
    style.name = name;

    style.effects = [{
        type: isBackdrop ? 'BACKGROUND_BLUR' : 'LAYER_BLUR',
        radius: radius,
        visible: true,
        boundVariables: variable ? {
            radius: { type: 'VARIABLE_ALIAS', id: variable.id }
        } : undefined
    } as Effect];
}

async function createGridStyle(name: string, width: number): Promise<void> {
    const allGridStyles = await figma.getLocalGridStylesAsync();
    var existing = allGridStyles.find(function (s: GridStyle) { return s.name === name; });
    var style = existing || figma.createGridStyle();
    style.name = name;

    style.layoutGrids = [{
        pattern: 'COLUMNS',
        alignment: 'CENTER',
        gutterSize: 0,
        count: 1,
        sectionSize: width,
        offset: 0,
        visible: true,
    }];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function countTokens(tokens: ParsedTokenSet, options: ImportOptions): number {
    var count = 0;
    if (options.importColors) count += tokens.colors.length;
    if (options.importSpacing) count += tokens.spacing.length;
    if (options.importRadius) count += tokens.radius.length;
    if (options.importShadows) count += tokens.shadows.length;
    if (options.importBlur) {
        count += tokens.blur.length;
        count += (tokens.backdropBlur || []).length;
    }
    if (options.importTypography) {
        count += tokens.typography.length;
        count += (tokens.fonts || []).length;
    }
    count += tokens.opacity.length;
    if (options.importBreakpoints) count += tokens.breakpoints.length;
    if (options.importContainers) count += tokens.containers.length;
    if (options.importFontWeights) count += tokens.fontWeights.length;
    if (options.importTracking) count += tokens.tracking.length;
    if (options.importTracking) count += tokens.tracking.length;
    if (options.importLeading) count += tokens.leading.length;
    if (options.importLeading) count += tokens.leading.length;
    if (options.importMaxWidth && tokens.maxWidth) count += tokens.maxWidth.length;
    if (options.importBorderWidth && tokens.borderWidth) count += tokens.borderWidth.length;
    if (options.importOpacity && tokens.opacity) count += tokens.opacity.length;
    if (options.importSkew && tokens.skew) count += tokens.skew.length;
    return count;
}
