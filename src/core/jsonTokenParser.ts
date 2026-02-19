// ─── JSON Token Parser ───────────────────────────────────────────────────────
// Generic parser for the flat JSON format used by local token files.
// Handles tokens in the `{ "path/name": { "Light": "#hex", "Dark": "#hex" } }` format.

import { parseColorValue, type FigmaColor } from './colorUtils';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface JsonThemeTokens {
    light: Record<string, string>;
    dark: Record<string, string>;
}

export interface JsonColorToken {
    name: string;
    light: FigmaColor | null;
    dark: FigmaColor | null;
}

export interface JsonFloatToken {
    name: string;
    light: number;
    dark: number;
}

// ─── Parser ──────────────────────────────────────────────────────────────────

/**
 * Parse a flat JSON token file into light/dark theme token maps.
 * Expects format: `{ "category/name": { "Light": "#value", "Dark": "#value" } }`
 *
 * Non-color tokens (fonts, animations) are skipped for the color map.
 */
export function parseJsonTokens(
    data: Record<string, any>,
    options?: { stripCategoryPrefix?: boolean }
): JsonThemeTokens {
    const light: Record<string, string> = {};
    const dark: Record<string, string> = {};

    for (const [key, value] of Object.entries(data)) {
        // Skip non-mode tokens (strings like font families, cubicBezier, etc.)
        if (typeof value === 'string') continue;

        // Skip typography composite objects (those with a 'size' property)
        if (typeof value === 'object' && value !== null && 'size' in value) continue;

        // Handle mode-based tokens: { "Light": "...", "Dark": "..." }
        if (typeof value === 'object' && value !== null && ('Light' in value || 'Dark' in value)) {
            const tokenName = options?.stripCategoryPrefix
                ? stripPrefix(key)
                : key;

            if (value.Light) light[tokenName] = value.Light;
            if (value.Dark) dark[tokenName] = value.Dark;
        }
    }

    return { light, dark };
}

/**
 * Extract float/dimension tokens from JSON data.
 * Looks for radius values like `{ "sm": 4, "md": 8 }` or
 * CSS dimension strings like "4px", "0.625rem".
 */
export function parseJsonFloatTokens(
    data: Record<string, any>,
    categoryPrefix: string
): JsonFloatToken[] {
    const results: JsonFloatToken[] = [];

    for (const [key, value] of Object.entries(data)) {
        if (!key.startsWith(categoryPrefix)) continue;

        const name = key.replace(`${categoryPrefix}/`, '');

        if (typeof value === 'object' && value !== null && ('Light' in value || 'Dark' in value)) {
            const lightVal = parseDimensionValue(value.Light);
            const darkVal = parseDimensionValue(value.Dark);
            if (lightVal !== null || darkVal !== null) {
                results.push({
                    name,
                    light: lightVal ?? darkVal ?? 0,
                    dark: darkVal ?? lightVal ?? 0,
                });
            }
        } else if (typeof value === 'string') {
            const parsed = parseDimensionValue(value);
            if (parsed !== null) {
                results.push({
                    name,
                    light: parsed,
                    dark: parsed,
                });
            }
        }
    }

    return results;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function stripPrefix(key: string): string {
    // "colors/background" → "background"
    // "primitives/gray-50" → "gray-50"
    const slashIdx = key.indexOf('/');
    return slashIdx >= 0 ? key.slice(slashIdx + 1) : key;
}

/**
 * Parse a CSS dimension string like "4px", "0.625rem", "10px" into a number.
 * Returns the pixel value (rem × 16).
 */
function parseDimensionValue(value: string | undefined): number | null {
    if (!value || typeof value !== 'string') return null;

    const pxMatch = value.match(/^([\d.]+)px$/);
    if (pxMatch) return parseFloat(pxMatch[1]);

    const remMatch = value.match(/^([\d.]+)rem$/);
    if (remMatch) return parseFloat(remMatch[1]) * 16;

    return null;
}
