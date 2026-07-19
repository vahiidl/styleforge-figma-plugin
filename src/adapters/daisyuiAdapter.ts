// ─── DaisyUI Adapter ─────────────────────────────────────────────────────────
// The built-in `light` and `dark` DaisyUI themes (oklch color tokens like
// primary/secondary/accent/base-100...) plus the radius/border size tokens.

import type { LibraryAdapter, ThemeResult, ThemeExtras, TokenCategory, SourceInfo } from './types';
import { parseDimension } from '../core/colorUtils';
import daisyTokens from '../data/daisyui.tokens.json';

export const daisyuiAdapter: LibraryAdapter = {
    id: 'daisyui',
    name: 'DaisyUI',
    description: 'Built-in light & dark themes: primary/secondary/accent/base colors plus radius tokens.',
    icon: 'daisyui',
    repoUrl: 'https://github.com/saadeghi/daisyui',
    type: 'theme',
    dependencies: [],
    defaultCollectionName: 'DaisyUI',
    categories: ['colors', 'radius'] as TokenCategory[],

    async fetchAndParse(): Promise<ThemeResult> {
        const data = daisyTokens as Record<string, unknown>;
        const light: Record<string, string> = {};
        const dark: Record<string, string> = {};
        const floats: NonNullable<ThemeExtras['floats']> = [];

        for (const [key, raw] of Object.entries(data)) {
            if (key.startsWith('_')) continue;
            const modes = raw as { Light?: string; Dark?: string };

            if (key.startsWith('float:')) {
                const name = key.replace('float:', '');
                const px = parseDimension(modes.Light || modes.Dark || '');
                if (px !== null) {
                    floats.push({
                        name: name.indexOf('radius') >= 0 ? `radius/${name.replace('radius-', '')}` : `border/${name}`,
                        value: px,
                        scopes: name.indexOf('radius') >= 0 ? ['CORNER_RADIUS'] : ['STROKE_FLOAT'],
                        codeSyntax: `var(--${name})`,
                    });
                }
                continue;
            }

            if (modes.Light) light[`--${key}`] = modes.Light;
            if (modes.Dark) dark[`--${key}`] = modes.Dark;
        }

        const meta = (data._source || {}) as { version?: string };
        const source: SourceInfo = { kind: 'bundled', version: meta.version };
        return { type: 'theme', tokens: { light, dark }, source, extras: { floats } };
    },
};
