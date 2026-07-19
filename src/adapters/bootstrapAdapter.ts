// ─── Bootstrap 5 Adapter ─────────────────────────────────────────────────────
// The --bs-* custom properties from bootstrap.css: brand + gray palettes and
// semantic body/link/border colors, with the [data-bs-theme=dark] overrides
// as the Dark mode.

import type { LibraryAdapter, ThemeResult, TokenCategory, SourceInfo } from './types';
import bootstrapTokens from '../data/bootstrap.tokens.json';

export const bootstrapAdapter: LibraryAdapter = {
    id: 'bootstrap',
    name: 'Bootstrap 5',
    description: 'The --bs-* palette: brand & gray scales plus semantic body/link/border colors, Light/Dark.',
    icon: 'bootstrap',
    repoUrl: 'https://github.com/twbs/bootstrap',
    type: 'theme',
    dependencies: [],
    defaultCollectionName: 'Bootstrap',
    categories: ['colors'] as TokenCategory[],

    async fetchAndParse(): Promise<ThemeResult> {
        const data = bootstrapTokens as Record<string, unknown>;
        const light: Record<string, string> = {};
        const dark: Record<string, string> = {};

        for (const [key, raw] of Object.entries(data)) {
            if (key.startsWith('_')) continue;
            // `primary-rgb`-style helper triplets aren't CSS colors — skip.
            if (key.endsWith('-rgb')) continue;
            const modes = raw as { Light?: string; Dark?: string };
            if (modes.Light) light[`--${key}`] = modes.Light;
            if (modes.Dark) dark[`--${key}`] = modes.Dark;
        }

        const meta = (data._source || {}) as { version?: string };
        const source: SourceInfo = { kind: 'bundled', version: meta.version };
        return { type: 'theme', tokens: { light, dark }, source };
    },
};
