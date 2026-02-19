// ─── Base UI Adapter ─────────────────────────────────────────────────────────
// Provides Base UI design tokens (primitives + semantic + syntax colors)
// from a local JSON file. Light/Dark modes with Tailwind dependency.

import type { LibraryAdapter, ThemeResult, TokenCategory } from './types';
import { parseJsonTokens } from '../core/jsonTokenParser';
import baseUiTokens from '../data/base-ui.tokens.json';

export const baseUiAdapter: LibraryAdapter = {
    id: 'base-ui',
    name: 'Base UI',
    description: 'Semantic and syntax color tokens, Light/Dark modes for unstyled components.',
    icon: 'baseui',
    repoUrl: 'https://github.com/mui/base-ui',
    type: 'theme',
    dependencies: ['tailwindcss'],
    defaultCollectionName: 'Base UI',
    categories: ['colors'] as TokenCategory[],

    async fetchAndParse(): Promise<ThemeResult> {
        const { light, dark } = parseJsonTokens(baseUiTokens as Record<string, any>);

        return {
            type: 'theme',
            tokens: { light, dark },
        };
    },
};
