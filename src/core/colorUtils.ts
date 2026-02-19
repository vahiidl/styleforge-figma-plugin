// ─── Color Conversion Utilities ─────────────────────────────────────────────
// Converts oklch, HSL, HEX, and RGB color strings to Figma-compatible RGBA
// objects (0-1 range per channel).

export interface FigmaColor {
    r: number;
    g: number;
    b: number;
    a: number;
}

// ─── oklch → sRGB ───────────────────────────────────────────────────────────

/** Convert oklch(L C H) to Figma RGBA. L is 0-1, C is 0-0.4+, H is degrees. */
export function oklchToRgba(L: number, C: number, H: number, alpha = 1): FigmaColor {
    // oklch → oklab
    const hRad = (H * Math.PI) / 180;
    const a_ = C * Math.cos(hRad);
    const b_ = C * Math.sin(hRad);

    // oklab → linear sRGB via the M1 and M2 matrices
    const l_ = L + 0.3963377774 * a_ + 0.2158037573 * b_;
    const m_ = L - 0.1055613458 * a_ - 0.0638541728 * b_;
    const s_ = L - 0.0894841775 * a_ - 1.291485548 * b_;

    const l = l_ * l_ * l_;
    const m = m_ * m_ * m_;
    const s = s_ * s_ * s_;

    let r = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
    let g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
    let b = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

    // Clamp to sRGB gamut
    r = clamp01(linearToSrgb(r));
    g = clamp01(linearToSrgb(g));
    b = clamp01(linearToSrgb(b));

    return { r, g, b, a: alpha };
}

function linearToSrgb(c: number): number {
    if (c <= 0.0031308) return 12.92 * c;
    return 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

// ─── HSL → sRGB ─────────────────────────────────────────────────────────────

/** Convert hsl(H, S%, L%) to Figma RGBA. H in degrees, S/L as 0-100. */
export function hslToRgba(h: number, s: number, l: number, alpha = 1): FigmaColor {
    s /= 100;
    l /= 100;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;

    let r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; }
    else if (h < 120) { r = x; g = c; }
    else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; }
    else if (h < 300) { r = x; b = c; }
    else { r = c; b = x; }

    return {
        r: clamp01(r + m),
        g: clamp01(g + m),
        b: clamp01(b + m),
        a: alpha,
    };
}

// ─── HEX → sRGB ─────────────────────────────────────────────────────────────

/** Convert #RGB, #RRGGBB, or #RRGGBBAA to Figma RGBA. */
export function hexToRgba(hex: string): FigmaColor {
    hex = hex.replace('#', '');

    if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    if (hex.length === 4) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
    }

    const r = parseInt(hex.slice(0, 2), 16) / 255;
    const g = parseInt(hex.slice(2, 4), 16) / 255;
    const b = parseInt(hex.slice(4, 6), 16) / 255;
    const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;

    return { r, g, b, a };
}

// ─── RGB string → sRGB ──────────────────────────────────────────────────────

/** Convert rgb(R, G, B) or rgba(R, G, B, A) to Figma RGBA. */
export function rgbStringToRgba(str: string): FigmaColor | null {
    const match = str.match(
        /rgba?\(\s*([\d.]+)\s*,?\s*([\d.]+)\s*,?\s*([\d.]+)\s*(?:[,/]\s*([\d.%]+))?\s*\)/
    );
    if (!match) return null;

    const r = parseFloat(match[1]) / 255;
    const g = parseFloat(match[2]) / 255;
    const b = parseFloat(match[3]) / 255;
    let a = 1;
    if (match[4]) {
        a = match[4].endsWith('%') ? parseFloat(match[4]) / 100 : parseFloat(match[4]);
    }
    return { r: clamp01(r), g: clamp01(g), b: clamp01(b), a: clamp01(a) };
}

// ─── Universal color parser ─────────────────────────────────────────────────

/**
 * Parse any CSS color value string into a Figma RGBA object.
 * Supports: oklch(), hsl(), hsla(), rgb(), rgba(), #hex, named keywords.
 */
export function parseColorValue(value: string): FigmaColor | null {
    const v = value.trim().toLowerCase();

    // oklch(L C H) or oklch(L C H / A)
    const oklchMatch = v.match(
        /oklch\(\s*([\d.]+)%?\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+%?))?\s*\)/
    );
    if (oklchMatch) {
        let L = parseFloat(oklchMatch[1]);
        // If L > 1, it's a percentage
        if (L > 1) L /= 100;
        const C = parseFloat(oklchMatch[2]);
        const H = parseFloat(oklchMatch[3]);
        let alpha = 1;
        if (oklchMatch[4]) {
            alpha = oklchMatch[4].endsWith('%')
                ? parseFloat(oklchMatch[4]) / 100
                : parseFloat(oklchMatch[4]);
        }
        return oklchToRgba(L, C, H, alpha);
    }

    // hsl / hsla
    const hslMatch = v.match(
        /hsla?\(\s*([\d.]+)\s*[,\s]\s*([\d.]+)%?\s*[,\s]\s*([\d.]+)%?\s*(?:[,/]\s*([\d.]+%?))?\s*\)/
    );
    if (hslMatch) {
        const h = parseFloat(hslMatch[1]);
        const s = parseFloat(hslMatch[2]);
        const l = parseFloat(hslMatch[3]);
        let a = 1;
        if (hslMatch[4]) {
            a = hslMatch[4].endsWith('%') ? parseFloat(hslMatch[4]) / 100 : parseFloat(hslMatch[4]);
        }
        return hslToRgba(h, s, l, a);
    }

    // rgb / rgba
    if (v.startsWith('rgb')) {
        return rgbStringToRgba(v);
    }

    // Hex
    if (v.startsWith('#')) {
        return hexToRgba(v);
    }

    // Named colors (minimal set for common tokens)
    const named: Record<string, string> = {
        black: '#000000',
        white: '#ffffff',
        transparent: '#00000000',
    };
    if (named[v]) {
        return hexToRgba(named[v]);
    }

    return null;
}

// ─── Unit conversions ────────────────────────────────────────────────────────

/** Convert rem to px (assumes 16px base). */
export function remToPx(rem: number): number {
    return rem * 16;
}

/** Parse a CSS dimension value and return px. Handles rem, px, em. */
export function parseDimension(value: string): number | null {
    const match = value.trim().match(/^(-?[\d.]+)(rem|px|em)?$/);
    if (!match) return null;
    const num = parseFloat(match[1]);
    const unit = match[2] || 'px';
    switch (unit) {
        case 'rem':
        case 'em':
            return remToPx(num);
        case 'px':
            return num;
        default:
            return num;
    }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function clamp01(n: number): number {
    return Math.max(0, Math.min(1, n));
}

/** Compare two Figma colors for approximate equality. */
export function colorsMatch(a: FigmaColor, b: FigmaColor, tolerance = 0.005): boolean {
    return (
        Math.abs(a.r - b.r) < tolerance &&
        Math.abs(a.g - b.g) < tolerance &&
        Math.abs(a.b - b.b) < tolerance &&
        Math.abs(a.a - b.a) < tolerance
    );
}
