// ─── Material UI Adapter ─────────────────────────────────────────────────────
// The MUI default theme (light + dark palettes) extracted verbatim from
// @mui/material's createTheme(), plus spacing/radius, the elevation shadow
// set (1–24) as effect styles and the typography ramp as text styles.

import type { LibraryAdapter, ThemeResult, ThemeExtras, TokenCategory, SourceInfo } from './types';
import muiTokens from '../data/mui.tokens.json';

interface MuiData {
    _source?: { version?: string };
    colors: Record<string, { Light?: string; Dark?: string }>;
    floats: Record<string, number>;
    typography: Record<string, { fontSize: string | number; fontWeight: number; lineHeight: number; letterSpacing?: string }>;
    shadows: Record<string, string>;
}

function pxFromRem(v: string | number): number {
    if (typeof v === 'number') return v;
    if (v.endsWith('rem')) return parseFloat(v) * 16;
    return parseFloat(v);
}

function pxFromEm(v: string | undefined, fontSizePx: number): number | undefined {
    if (!v) return undefined;
    if (v.endsWith('em')) return parseFloat(v) * fontSizePx;
    return parseFloat(v);
}

export const muiAdapter: LibraryAdapter = {
    id: 'mui',
    name: 'Material UI',
    description: 'MUI default palette (Light/Dark), spacing, radius, elevation shadows 1–24 and the typography ramp.',
    icon: 'mui',
    repoUrl: 'https://github.com/mui/material-ui',
    type: 'theme',
    dependencies: [],
    defaultCollectionName: 'Material UI',
    categories: ['colors', 'spacing', 'radius', 'shadows', 'typography'] as TokenCategory[],

    async fetchAndParse(): Promise<ThemeResult> {
        const data = muiTokens as unknown as MuiData;

        const light: Record<string, string> = {};
        const dark: Record<string, string> = {};
        for (const [name, modes] of Object.entries(data.colors)) {
            if (modes.Light) light[`--${name}`] = modes.Light;
            if (modes.Dark) dark[`--${name}`] = modes.Dark;
        }

        const extras: ThemeExtras = {
            floats: Object.entries(data.floats).map(([name, value]) => ({
                name,
                value,
                scopes: name.indexOf('radius') >= 0 ? ['CORNER_RADIUS'] : ['GAP', 'WIDTH_HEIGHT'],
                codeSyntax: name.indexOf('radius') >= 0 ? 'theme.shape.borderRadius' : 'theme.spacing(1)',
            })),
            shadows: Object.entries(data.shadows).map(([name, value]) => ({
                name: `elevation/${name.replace('elevation-', '')}`,
                value,
            })),
            textStyles: Object.entries(data.typography).map(([name, t]) => {
                const sizePx = pxFromRem(t.fontSize);
                return {
                    name: `mui/${name}`,
                    family: 'Roboto',
                    fontSize: Math.round(sizePx * 100) / 100,
                    fontWeight: t.fontWeight,
                    lineHeight: t.lineHeight,
                    letterSpacing: pxFromEm(t.letterSpacing, sizePx),
                };
            }),
        };

        const source: SourceInfo = { kind: 'bundled', version: data._source?.version };
        return { type: 'theme', tokens: { light, dark }, source, extras };
    },
};
