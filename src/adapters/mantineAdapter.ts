// ─── Mantine Adapter ─────────────────────────────────────────────────────────
// The Mantine default theme (10-step color scales, spacing, radius, font
// sizes, shadows) extracted verbatim from @mantine/core. Single-mode primitives.

import type { LibraryAdapter, PrimitiveResult, TokenCategory, SourceInfo } from './types';
import { tokenSetFromFlatData } from './chakraAdapter';
import mantineTokens from '../data/mantine.tokens.json';

export const mantineAdapter: LibraryAdapter = {
    id: 'mantine',
    name: 'Mantine',
    description: 'Default theme: 10-step color scales, spacing, radius, font sizes and shadows.',
    icon: 'mantine',
    repoUrl: 'https://github.com/mantinedev/mantine',
    type: 'primitives',
    dependencies: [],
    defaultCollectionName: 'Mantine',
    categories: ['colors', 'spacing', 'radius', 'shadows', 'typography'] as TokenCategory[],

    async fetchAndParse(): Promise<PrimitiveResult> {
        const data = mantineTokens as unknown as Parameters<typeof tokenSetFromFlatData>[0];
        const source: SourceInfo = { kind: 'bundled', version: data._source?.version };
        return { type: 'primitives', tokens: tokenSetFromFlatData(data), source };
    },
};
