// ─── Coss.com Adapter ────────────────────────────────────────────────────────
// Provides Coss.com design tokens (colors + radius) from a local JSON file.
// Light/Dark modes with Tailwind dependency for variable aliasing.

import type { LibraryAdapter, ThemeResult, TokenCategory } from './types';
import { parseJsonTokens } from '../core/jsonTokenParser';
import cossTokens from '../data/coss.tokens.json';

export const cossAdapter: LibraryAdapter = {
    id: 'coss',
    name: 'Coss.com',
    description: 'Semantic color and radius tokens, Light/Dark modes for the Coss design system.',
    icon: 'coss',
    repoUrl: 'https://github.com/coss-ui/coss',
    type: 'theme',
    dependencies: ['tailwindcss'],
    defaultCollectionName: 'Coss',
    categories: ['colors', 'radius'] as TokenCategory[],

    async fetchAndParse(): Promise<ThemeResult> {
        const { light, dark } = parseJsonTokens(cossTokens as Record<string, any>);

        return {
            type: 'theme',
            tokens: { light, dark },
        };
    },
};
