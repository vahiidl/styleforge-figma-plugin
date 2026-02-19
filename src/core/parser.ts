// ─── CSS / Token Parsing Engine ──────────────────────────────────────────────
// Parses CSS variable declarations from various formats:
// - Tailwind v4 @theme blocks
// - Standard :root { } and .dark { } blocks
// - Raw key: value maps

import { parseColorValue, parseDimension, type FigmaColor } from './colorUtils';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CSSVariable {
    name: string;        // e.g. "--color-red-500"
    rawValue: string;    // e.g. "oklch(63.7% 0.237 25.331)"
}

export interface ParsedColor {
    path: string[];      // e.g. ["red", "500"]
    figmaColor: FigmaColor;
    rawValue: string;
}

export interface ParsedFloat {
    path: string[];      // e.g. ["4"]
    value: number;       // px value
    rawValue: string;
}

export interface ParsedShadow {
    name: string;
    shadows: ShadowLayer[];
    rawValue: string;
}

export interface ShadowLayer {
    x: number;
    y: number;
    blur: number;
    spread: number;
    color: FigmaColor;
    type: 'DROP_SHADOW' | 'INNER_SHADOW';
}

export interface ParsedTokenSet {
    colors: ParsedColor[];
    spacing: ParsedFloat[];
    radius: ParsedFloat[];
    shadows: ParsedShadow[];
    blur: ParsedFloat[];
    typography: ParsedTypography[];
    opacity: ParsedFloat[];
    fonts: ParsedFont[];
    breakpoints: ParsedFloat[];
    containers: ParsedFloat[];
    fontWeights: ParsedFloat[];
    tracking: ParsedFloat[];
    leading: ParsedFloat[];
    borderWidth: ParsedFloat[];
    backdropBlur: ParsedFloat[];
    maxWidth: ParsedFloat[];
    skew: ParsedFloat[];
}

export interface ParsedTypography {
    name: string;
    fontSize: number;
    lineHeight?: number;
    letterSpacing?: number;
    fontWeight?: number;
    rawValue: string;
}

export interface ParsedFont {
    name: string;
    family: string;
    rawValue: string;
}

export interface ThemeTokens {
    light: Record<string, string>;
    dark: Record<string, string>;
}

// ─── CSS Variable Extraction ─────────────────────────────────────────────────

/**
 * Extract all CSS custom property declarations from a CSS string.
 * Handles multi-line values (e.g. font stacks, shadow lists).
 */
export function extractCSSVariables(css: string): CSSVariable[] {
    const vars: CSSVariable[] = [];
    // Match --name: value (possibly multiline, ending at next -- or })
    const regex = /(--[\w-]+)\s*:\s*([^;]+)/g;
    let match;
    while ((match = regex.exec(css)) !== null) {
        vars.push({
            name: match[1].trim(),
            rawValue: match[2].trim().replace(/\s+/g, ' '),
        });
    }
    return vars;
}

/**
 * Parse a Tailwind v4 @theme default { ... } block.
 * Returns the raw CSS variables within the block.
 */
export function parseThemeBlock(css: string): CSSVariable[] {
    // Find @theme default { ... }, may have optional keywords like `inline reference`
    const themeMatch = css.match(/@theme\s+[^{]*\{([\s\S]*?)\n\}/);
    if (!themeMatch) return [];
    return extractCSSVariables(themeMatch[1]);
}

/**
 * Parse :root { ... } and .dark { ... } (or [data-theme="dark"]) blocks.
 * Returns separate light and dark variable maps.
 */
export function parseRootAndDark(css: string): ThemeTokens {
    const light: Record<string, string> = {};
    const dark: Record<string, string> = {};

    // Extract :root block
    const rootMatch = css.match(/:root\s*\{([\s\S]*?)\}/);
    if (rootMatch) {
        const vars = extractCSSVariables(rootMatch[1]);
        for (const v of vars) {
            light[v.name] = v.rawValue;
        }
    }

    // Extract .dark block
    const darkMatch = css.match(/\.dark\s*\{([\s\S]*?)\}/);
    if (darkMatch) {
        const vars = extractCSSVariables(darkMatch[1]);
        for (const v of vars) {
            dark[v.name] = v.rawValue;
        }
    }

    return { light, dark };
}

// ─── Token Categorization ────────────────────────────────────────────────────

/**
 * Categorize raw CSS variables into typed token groups (colors, spacing, etc.).
 * Used primarily for the Tailwind adapter.
 */
export function categorizeTokens(vars: CSSVariable[]): ParsedTokenSet {
    const result: ParsedTokenSet = {
        colors: [],
        spacing: [],
        radius: [],
        shadows: [],
        blur: [],
        backdropBlur: [],
        typography: [],
        opacity: [],
        fonts: [],
        breakpoints: [],
        containers: [],
        fontWeights: [],
        tracking: [],
        leading: [],
        borderWidth: [],
        maxWidth: [],
        skew: [],
    };

    for (const v of vars) {
        const name = v.name.replace(/^--/, '');

        // ── Colors ──
        if (name.startsWith('color-')) {
            const parts = name.replace('color-', '').split('-');
            const color = parseColorValue(v.rawValue);
            if (color) {
                result.colors.push({ path: parts, figmaColor: color, rawValue: v.rawValue });
            }
            continue;
        }

        // ── Spacing ──
        if (name === 'spacing') {
            const dim = parseDimension(v.rawValue);
            if (dim !== null) {
                result.spacing.push({ path: ['base'], value: dim, rawValue: v.rawValue });
            }
            continue;
        }

        // ── Breakpoints ──
        if (name.startsWith('breakpoint-')) {
            const bpName = name.replace('breakpoint-', '');
            const dim = parseDimension(v.rawValue);
            if (dim !== null) {
                result.breakpoints.push({ path: [bpName], value: dim, rawValue: v.rawValue });
            }
            continue;
        }

        // ── Containers ──
        if (name.startsWith('container-')) {
            const contName = name.replace('container-', '');
            const dim = parseDimension(v.rawValue);
            if (dim !== null) {
                result.containers.push({ path: [contName], value: dim, rawValue: v.rawValue });
            }
            continue;
        }

        // ── Max Width ──
        if (name.startsWith('max-w-') || name.startsWith('max-width-')) {
            const mwName = name.replace(/^max-w(idth)?-/, '');
            const dim = parseDimension(v.rawValue);
            if (dim !== null) {
                result.maxWidth.push({ path: [mwName], value: dim, rawValue: v.rawValue });
            }
            continue;
        }

        // ── Font Weights ──
        if (name.startsWith('font-weight-')) {
            const weightName = name.replace('font-weight-', '');
            const val = parseFloat(v.rawValue);
            if (!isNaN(val)) {
                result.fontWeights.push({ path: [weightName], value: val, rawValue: v.rawValue });
            }
            continue;
        }

        // ── Tracking (letter-spacing) ──
        if (name.startsWith('tracking-')) {
            const trackName = name.replace('tracking-', '');
            const dim = parseDimension(v.rawValue);
            if (dim !== null) {
                result.tracking.push({ path: [trackName], value: dim, rawValue: v.rawValue });
            }
            continue;
        }

        // ── Leading (line-height) ──
        if (name.startsWith('leading-')) {
            const leadName = name.replace('leading-', '');
            const val = parseFloat(v.rawValue);
            if (!isNaN(val)) {
                result.leading.push({ path: [leadName], value: val, rawValue: v.rawValue });
            }
            continue;
        }

        // ── Radius ──
        if (name.startsWith('radius')) {
            const parts = name.replace('radius-', '').split('-');
            if (name === 'radius') parts[0] = 'default';
            const dim = parseDimension(v.rawValue);
            if (dim !== null) {
                result.radius.push({ path: parts, value: dim, rawValue: v.rawValue });
            }
            continue;
        }

        // ── Shadows (Merged into drop-shadow) ──
        if (name.startsWith('shadow-') && !name.startsWith('shadow-inner')) {
            const baseName = name.replace('shadow-', '');
            const shadowName = 'drop-shadow/' + baseName;
            const layers = parseShadowValue(v.rawValue);
            if (layers.length > 0) {
                result.shadows.push({ name: shadowName, shadows: layers, rawValue: v.rawValue });
            }
            continue;
        }

        // ── Inset Shadows ──
        if (name.startsWith('inset-shadow-')) {
            const baseName = name.replace('inset-shadow-', '');
            const shadowName = 'inset-shadow/' + baseName;
            const layers = parseShadowValue(v.rawValue);
            if (layers.length > 0) {
                result.shadows.push({ name: shadowName, shadows: layers, rawValue: v.rawValue });
            }
            continue;
        }

        // ── Drop Shadows ──
        if (name.startsWith('drop-shadow-')) {
            const baseName = name.replace('drop-shadow-', '');
            const dsName = 'drop-shadow/' + baseName;
            const layers = parseShadowValue(v.rawValue);
            if (layers.length > 0) {
                result.shadows.push({ name: dsName, shadows: layers, rawValue: v.rawValue });
            }
            continue;
        }

        // ── Text Shadows ──
        if (name.startsWith('text-shadow-')) {
            const tsName = 'text-shadow/' + name.replace('text-shadow-', '');
            const layers = parseShadowValue(v.rawValue);
            if (layers.length > 0) {
                result.shadows.push({ name: tsName, shadows: layers, rawValue: v.rawValue });
            }
            continue;
        }

        // ── Blur (Layer Blur) ──
        if (name.startsWith('blur')) {
            const parts = name.replace('blur-', '').split('-');
            if (name === 'blur') parts[0] = 'default';
            const dim = parseDimension(v.rawValue);
            if (dim !== null) {
                result.blur.push({ path: parts, value: dim, rawValue: v.rawValue });
            }
            continue;
        }

        // ── Backdrop Blur (Background Blur) ──
        if (name.startsWith('backdrop-blur')) {
            const parts = name.replace('backdrop-blur-', '').split('-');
            if (name === 'backdrop-blur') parts[0] = 'default';
            const dim = parseDimension(v.rawValue);
            if (dim !== null) {
                result.backdropBlur.push({ path: parts, value: dim, rawValue: v.rawValue });
            }
            continue;
        }

        // ── Typography (text sizes with line-height) ──
        if (name.startsWith('text-') && !name.includes('shadow')) {
            // text-sm, text-lg, etc. (not text-shadow-*)
            if (name.endsWith('--line-height') || name.endsWith('--letter-spacing') || name.endsWith('--font-weight')) {
                // Skip modifiers here; they're handled alongside their parent
                continue;
            }
            const sizeName = name.replace('text-', '');
            const dim = parseDimension(v.rawValue);
            if (dim !== null) {
                // Look for corresponding line-height
                const lhVar = vars.find(function (lv) { return lv.name === '--' + name + '--line-height'; });
                var lineHeight: number | undefined;
                if (lhVar) {
                    // Line heights are often ratios like "calc(1.25 / 0.875)"
                    lineHeight = evaluateCalc(lhVar.rawValue);
                }

                // Look for corresponding letter-spacing
                const lsVar = vars.find(function (lv) { return lv.name === '--' + name + '--letter-spacing'; });
                var letterSpacing: number | undefined;
                if (lsVar) {
                    const val = parseDimension(lsVar.rawValue);
                    if (val !== null) letterSpacing = val;
                }

                // Look for corresponding font-weight
                const fwVar = vars.find(function (lv) { return lv.name === '--' + name + '--font-weight'; });
                var fontWeight: number | undefined;
                if (fwVar) {
                    const val = parseFloat(fwVar.rawValue);
                    if (!isNaN(val)) fontWeight = val;
                }

                result.typography.push({
                    name: sizeName,
                    fontSize: dim,
                    lineHeight: lineHeight,
                    letterSpacing: letterSpacing,
                    fontWeight: fontWeight,
                    rawValue: v.rawValue,
                });
            }
            continue;
        }

        // ── Fonts ──
        if (name.startsWith('font-') && !name.startsWith('font-weight-')) {
            result.fonts.push({
                name: name.replace('font-', ''),
                family: v.rawValue.split(',')[0].trim().replace(/['"]/g, ''),
                rawValue: v.rawValue,
            });
            continue;
        }

        // ── Opacity ──
        if (name.startsWith('opacity-')) {
            const parts = name.replace('opacity-', '').split('-');
            const val = parseFloat(v.rawValue);
            if (!isNaN(val)) {
                result.opacity.push({ path: parts, value: val, rawValue: v.rawValue });
            }
        }

        // ── Border Width ──
        if (name.startsWith('border-width-')) {
            const parts = name.replace('border-width-', '').split('-');
            const dim = parseDimension(v.rawValue);
            if (dim !== null) {
                result.borderWidth.push({ path: parts, value: dim, rawValue: v.rawValue });
            }
            continue;
        }

        // ── Skew ──
        if (name.startsWith('skew-')) {
            const parts = name.replace('skew-', '').split('-');
            const val = parseFloat(v.rawValue); // Parse as float (degrees or unitless)
            if (!isNaN(val)) {
                result.skew.push({ path: parts, value: val, rawValue: v.rawValue });
            }
            continue;
        }
    }

    // Generate spacing scale from base value
    if (result.spacing.length === 1) {
        const base = result.spacing[0].value;
        result.spacing = generateSpacingScale(base);
    }

    return result;
}

// ─── Shadow Parsing ──────────────────────────────────────────────────────────

/**
 * Parse a CSS box-shadow value into individual layers.
 * Handles comma-separated multi-shadow values and inset keyword.
 */
export function parseShadowValue(value: string): ShadowLayer[] {
    const layers: ShadowLayer[] = [];
    // Split by commas (but not commas inside rgb/rgba/oklch functions)
    const parts = splitShadowParts(value);

    for (const part of parts) {
        var trimmed = part.trim();
        if (!trimmed) continue;

        var isInset = trimmed.startsWith('inset');
        var shadow = trimmed.replace(/^inset\s+/, '');

        // Match: x y blur spread? color
        // Color can be rgb(...) or oklch(...) or hsl(...)
        var colorMatch = shadow.match(/((?:rgb|oklch|hsl)a?\([^)]+\))/);
        var colorStr = colorMatch ? colorMatch[1] : 'rgb(0 0 0 / 0.1)';
        var withoutColor = shadow.replace(colorStr, '').trim();

        var nums = withoutColor.split(/\s+/).map(function (n) { return parseDimension(n) || 0; });

        var x = nums[0] || 0;
        var y = nums[1] || 0;
        var blurVal = nums[2] || 0;
        var spread = nums[3] || 0;
        var color = parseColorValue(colorStr) || { r: 0, g: 0, b: 0, a: 0.1 };

        layers.push({
            x: x, y: y, blur: blurVal, spread: spread, color: color,
            type: isInset ? 'INNER_SHADOW' : 'DROP_SHADOW',
        });
    }

    return layers;
}

/** Split comma-separated shadow values, respecting parentheses. */
function splitShadowParts(value: string): string[] {
    var parts: string[] = [];
    var depth = 0;
    var current = '';

    for (var i = 0; i < value.length; i++) {
        var char = value[i];
        if (char === '(') depth++;
        if (char === ')') depth--;
        if (char === ',' && depth === 0) {
            parts.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    if (current.trim()) parts.push(current);
    return parts;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Evaluate simple calc() expressions like "calc(1.25 / 0.875)". */
function evaluateCalc(value: string): number | undefined {
    var calcMatch = value.match(/calc\(\s*([\d.]+)\s*\/\s*([\d.]+)\s*\)/);
    if (calcMatch) {
        var numerator = parseFloat(calcMatch[1]);
        var denominator = parseFloat(calcMatch[2]);
        if (denominator !== 0) return numerator / denominator;
    }
    var num = parseFloat(value);
    return isNaN(num) ? undefined : num;
}

/**
 * Generate Tailwind-style spacing scale from a base value.
 * Tailwind v4 uses --spacing as a multiplier base (default 0.25rem = 4px).
 * Dots in step names replaced with underscores for Figma variable name compatibility.
 */
function generateSpacingScale(basePx: number): ParsedFloat[] {
    var steps = [
        0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8, 9, 10,
        11, 12, 14, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56,
        60, 64, 72, 80, 96,
    ];

    return steps.map(function (step) {
        // Replace dots with underscores in variable name to avoid Figma "invalid variable name" error
        var safeName = String(step).replace(/\./g, '_');
        return {
            path: [safeName],
            value: step * basePx,
            rawValue: step * basePx + 'px',
        };
    });
}
