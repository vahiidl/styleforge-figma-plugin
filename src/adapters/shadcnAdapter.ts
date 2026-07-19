// ─── Shadcn UI Adapter ───────────────────────────────────────────────────────
// Imports the current shadcn/ui default theme with a configurable base color
// (neutral, stone, zinc, ...) and optional accent theme merged on top.
// Live-fetches registry/themes.ts from shadcn-ui/ui at import time and falls
// back to the bundled snapshot when offline.

import type { AdapterConfig, LibraryAdapter, ThemeResult, ThemeExtras, TokenCategory, SourceInfo } from './types';
import { fetchRawFromGitHub } from '../core/fetcher';
import { parseColorValue } from '../core/colorUtils';
import shadcnThemesBundled from '../data/shadcn-themes.json';

const THEMES_PATH = 'apps/v4/registry/themes.ts';

export const SHADCN_BASE_COLORS = ['neutral', 'stone', 'zinc', 'mauve', 'olive', 'mist', 'taupe'];
export const SHADCN_ACCENTS = [
    'amber', 'blue', 'cyan', 'emerald', 'fuchsia', 'green', 'indigo', 'lime',
    'orange', 'pink', 'purple', 'red', 'rose', 'sky', 'teal', 'violet', 'yellow',
];

interface ThemeMap {
    [name: string]: { title: string; light: Record<string, string>; dark: Record<string, string> };
}

/** Parse the THEMES array out of shadcn's themes.ts source. */
export function parseThemesTs(src: string): ThemeMap {
    const themes: ThemeMap = {};
    const themeRe = /\{\s*name:\s*"([\w-]+)",\s*title:\s*"([^"]+)",\s*type:\s*"registry:theme",\s*cssVars:\s*\{([\s\S]*?)\n  \}/g;
    let m: RegExpExecArray | null;
    while ((m = themeRe.exec(src)) !== null) {
        const [, name, title, body] = m;
        const lightM = body.match(/light:\s*\{([\s\S]*?)\n      \}/);
        const darkM = body.match(/dark:\s*\{([\s\S]*?)\n      \}/);
        const grab = (s: string): Record<string, string> => {
            const out: Record<string, string> = {};
            const varRe = /"?([\w-]+)"?:\s*"([^"]+)"/g;
            let mm: RegExpExecArray | null;
            while ((mm = varRe.exec(s)) !== null) out[mm[1]] = mm[2];
            return out;
        };
        themes[name] = { title, light: lightM ? grab(lightM[1]) : {}, dark: darkM ? grab(darkM[1]) : {} };
    }
    return themes;
}

/** Multiply a CSS color's alpha and return a plain rgba() string. */
export function alphaVariant(cssValue: string | undefined, alphaFactor: number): string | null {
    if (!cssValue) return null;
    const c = parseColorValue(cssValue);
    if (!c) return null;
    const to255 = (v: number) => Math.round(v * 255);
    const a = Math.round(c.a * alphaFactor * 1000) / 1000;
    return `rgba(${to255(c.r)}, ${to255(c.g)}, ${to255(c.b)}, ${a})`;
}

/** State/alpha recipes used across shadcn v4 components (cannot be plain aliases). */
export function buildStateExtras(
    light: Record<string, string>,
    dark: Record<string, string>
): ThemeExtras['stateColors'] {
    const entries: NonNullable<ThemeExtras['stateColors']> = [];
    const push = (name: string, l: string | null, d: string | null, codeSyntax: string) => {
        if (l && d) entries.push({ name, light: l, dark: d, codeSyntax });
    };
    // focus-visible:ring-ring/50 (3px ring in components)
    push('state/ring-50', alphaVariant(light['ring'], 0.5), alphaVariant(dark['ring'], 0.5), '--ring 50%');
    // dark:bg-input/30 and dark:hover:bg-input/50 on transparent controls
    push('state/input-30', 'rgba(0, 0, 0, 0)', alphaVariant(dark['input'], 0.3) || 'rgba(255,255,255,0.045)', 'transparent | dark: --input 30%');
    push('state/input-50', 'rgba(0, 0, 0, 0)', alphaVariant(dark['input'], 0.5) || 'rgba(255,255,255,0.075)', 'transparent | dark: --input 50%');
    // hover rows / footers
    push('state/muted-50', alphaVariant(light['muted'], 0.5), alphaVariant(dark['muted'], 0.5), '--muted 50%');
    push('state/accent-50', alphaVariant(light['accent'], 0.5), alphaVariant(dark['accent'], 0.5), '--accent 50%');
    // aria-invalid ring: destructive/20 light, /40 dark
    push('state/destructive-ring', alphaVariant(light['destructive'], 0.2), alphaVariant(dark['destructive'], 0.4), '--destructive 20% | dark 40%');
    // dialog/sheet overlay bg-black/50
    push('state/overlay', 'rgba(0, 0, 0, 0.5)', 'rgba(0, 0, 0, 0.5)', 'rgb(0 0 0 / 50%)');
    return entries;
}

/** Tailwind v4 shadow tiers referenced constantly by shadcn components. */
const SHADOW_TIERS: NonNullable<ThemeExtras['shadows']> = [
    { name: 'shadow/xs', value: '0 1px 2px 0 rgb(0 0 0 / 0.05)' },
    { name: 'shadow/sm', value: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)' },
    { name: 'shadow/md', value: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' },
    { name: 'shadow/lg', value: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)' },
    { name: 'shadow/xl', value: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)' },
];

function prefixKeys(data: Record<string, string>): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(data)) {
        result[`--${key}`] = value;
    }
    return result;
}

export const shadcnAdapter: LibraryAdapter = {
    id: 'shadcn',
    name: 'Shadcn UI',
    description: 'Current default theme with selectable base color and accent, Light/Dark modes, radius scale, state recipes and shadow styles.',
    icon: 'shadcn',
    repoUrl: 'https://github.com/shadcn-ui/ui',
    type: 'theme',
    dependencies: ['tailwindcss'],
    defaultCollectionName: 'Shadcn',
    categories: ['colors', 'radius', 'shadows'] as TokenCategory[],
    configOptions: [
        {
            key: 'baseColor',
            label: 'Base color',
            type: 'select',
            choices: SHADCN_BASE_COLORS.map(c => ({ value: c, label: c.charAt(0).toUpperCase() + c.slice(1) })),
        },
        {
            key: 'accent',
            label: 'Accent theme',
            type: 'select',
            choices: [{ value: '', label: 'None (base only)' }, ...SHADCN_ACCENTS.map(c => ({ value: c, label: c.charAt(0).toUpperCase() + c.slice(1) }))],
        },
    ],

    async fetchAndParse(config?: AdapterConfig): Promise<ThemeResult> {
        const baseColor = config?.baseColor && SHADCN_BASE_COLORS.includes(config.baseColor)
            ? config.baseColor : 'neutral';
        const accent = config?.accent && SHADCN_ACCENTS.includes(config.accent)
            ? config.accent : undefined;

        let themes: ThemeMap = (shadcnThemesBundled as { themes: ThemeMap }).themes;
        let source: SourceInfo = {
            kind: 'bundled',
            version: (shadcnThemesBundled as { _source?: { commit?: string } })._source?.commit,
        };

        try {
            const src = await fetchRawFromGitHub('shadcn-ui', 'ui', THEMES_PATH, 'main');
            const parsed = parseThemesTs(src);
            if (parsed[baseColor] && Object.keys(parsed[baseColor].light).length > 0) {
                themes = parsed;
                source = {
                    kind: 'live',
                    url: `https://raw.githubusercontent.com/shadcn-ui/ui/main/${THEMES_PATH}`,
                    fetchedAt: new Date().toISOString().slice(0, 10),
                };
            }
        } catch (e) {
            // offline / rate-limited → bundled snapshot
        }

        const base = themes[baseColor];
        if (!base) throw new Error(`Unknown shadcn base color "${baseColor}"`);

        const light: Record<string, string> = { ...base.light };
        const dark: Record<string, string> = { ...base.dark };
        if (accent && themes[accent]) {
            Object.assign(light, themes[accent].light);
            Object.assign(dark, themes[accent].dark);
        }

        const extras: ThemeExtras = {
            strings: [
                { name: 'typography/font-sans', value: 'Geist', scopes: ['FONT_FAMILY'], codeSyntax: 'var(--font-sans)' },
                { name: 'typography/font-mono', value: 'Geist Mono', scopes: ['FONT_FAMILY'], codeSyntax: 'var(--font-mono)' },
            ],
            stateColors: buildStateExtras(light, dark),
            shadows: SHADOW_TIERS,
        };

        return {
            type: 'theme',
            tokens: { light: prefixKeys(light), dark: prefixKeys(dark) },
            source,
            extras,
        };
    },
};
