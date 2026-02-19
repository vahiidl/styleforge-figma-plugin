// ─── Shadcn UI Adapter ───────────────────────────────────────────────────────
// Provides the default Shadcn UI theme (light + dark modes) as semantic tokens
// that alias to Tailwind CSS primitives.
// Uses local JSON fallback files as the primary source.

import type { LibraryAdapter, ThemeResult, TokenCategory } from './types';
import shadcnLightFallback from '../data/shadcn-light.tokens.json';
import shadcnDarkFallback from '../data/shadcn-dark.tokens.json';

/**
 * Convert local fallback JSON (key → value) into the `--key → value` format
 * expected by the theme import pipeline.
 */
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
    description: 'Semantic theme tokens with Light and Dark modes, background, primary, secondary, muted, accent, and more.',
    icon: 'shadcn',
    repoUrl: 'https://github.com/shadcn-ui/ui',
    type: 'theme',
    dependencies: ['tailwindcss'],
    defaultCollectionName: 'Shadcn',
    categories: ['colors'] as TokenCategory[],

    async fetchAndParse(): Promise<ThemeResult> {
        // Use local JSON fallback files as the source of truth
        const light = prefixKeys(shadcnLightFallback as Record<string, string>);
        const dark = prefixKeys(shadcnDarkFallback as Record<string, string>);

        return {
            type: 'theme',
            tokens: { light, dark },
        };
    },
};
