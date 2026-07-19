// ─── Radix Colors Adapter ────────────────────────────────────────────────────
// The full @radix-ui/colors palette: 30+ scales × 12 steps, solid + alpha,
// with true Light/Dark pairs (blue ↔ blueDark, blueA ↔ blueDarkA).

import type { LibraryAdapter, ThemeResult, TokenCategory, SourceInfo } from './types';
import { parseJsonTokens } from '../core/jsonTokenParser';
import radixTokens from '../data/radix-colors.tokens.json';

export const radixColorsAdapter: LibraryAdapter = {
    id: 'radix-colors',
    name: 'Radix Colors',
    description: 'All Radix color scales (12 steps, solid + alpha) with Light/Dark modes.',
    icon: 'radix',
    repoUrl: 'https://github.com/radix-ui/colors',
    type: 'theme',
    dependencies: [],
    defaultCollectionName: 'Radix Colors',
    categories: ['colors'] as TokenCategory[],

    async fetchAndParse(): Promise<ThemeResult> {
        const data = radixTokens as Record<string, unknown>;
        const { light, dark } = parseJsonTokens(data as Record<string, never>);
        const meta = (data._source || {}) as { version?: string };
        const source: SourceInfo = { kind: 'bundled', version: meta.version };
        return { type: 'theme', tokens: { light, dark }, source };
    },
};
