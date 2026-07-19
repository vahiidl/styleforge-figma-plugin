// ─── Chakra UI Adapter ───────────────────────────────────────────────────────
// The Chakra UI default theme (colors, spacing, radii, font sizes/weights,
// shadows) extracted verbatim from @chakra-ui/theme. Single-mode primitives.

import type { LibraryAdapter, PrimitiveResult, TokenCategory, SourceInfo } from './types';
import { parseColorValue } from '../core/colorUtils';
import { parseShadowValue, type ParsedTokenSet } from '../core/parser';
import chakraTokens from '../data/chakra.tokens.json';

interface FlatData {
    _source?: { version?: string };
    colors: Record<string, string>;
    floats: Record<string, number>;
    shadows: Record<string, string>;
}

/** Shared builder for flat {colors, floats, shadows} snapshots (Chakra, Mantine). */
export function tokenSetFromFlatData(data: FlatData): ParsedTokenSet {
    const tokens: ParsedTokenSet = {
        colors: [], spacing: [], radius: [], shadows: [], blur: [],
        typography: [], opacity: [], fonts: [], breakpoints: [], containers: [],
        fontWeights: [], tracking: [], leading: [], borderWidth: [],
        backdropBlur: [], maxWidth: [], skew: [],
    };

    for (const [name, value] of Object.entries(data.colors)) {
        const color = parseColorValue(value);
        if (color) tokens.colors.push({ path: name.split('/'), figmaColor: color, rawValue: value });
    }

    for (const [name, value] of Object.entries(data.floats)) {
        const path = name.split('/');
        const group = path.shift();
        const entry = { path, value, rawValue: String(value) };
        if (group === 'spacing') tokens.spacing.push(entry);
        else if (group === 'radius') tokens.radius.push(entry);
        else if (group === 'fontSize') tokens.typography.push({ name: path.join('/'), fontSize: value, rawValue: String(value) });
        else if (group === 'fontWeight') tokens.fontWeights.push(entry);
    }

    for (const [name, value] of Object.entries(data.shadows)) {
        const layers = parseShadowValue(value);
        if (layers.length > 0) tokens.shadows.push({ name: `shadow/${name}`, shadows: layers, rawValue: value });
    }

    return tokens;
}

export const chakraAdapter: LibraryAdapter = {
    id: 'chakra',
    name: 'Chakra UI',
    description: 'Default theme: color scales, spacing, radii, font sizes/weights and shadows.',
    icon: 'chakra',
    repoUrl: 'https://github.com/chakra-ui/chakra-ui',
    type: 'primitives',
    dependencies: [],
    defaultCollectionName: 'Chakra UI',
    categories: ['colors', 'spacing', 'radius', 'shadows', 'typography', 'fontWeights'] as TokenCategory[],

    async fetchAndParse(): Promise<PrimitiveResult> {
        const data = chakraTokens as unknown as FlatData;
        const source: SourceInfo = { kind: 'bundled', version: data._source?.version };
        return { type: 'primitives', tokens: tokenSetFromFlatData(data), source };
    },
};
