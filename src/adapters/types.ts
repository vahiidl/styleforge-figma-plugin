// ─── Adapter Types ───────────────────────────────────────────────────────────
// Defines the interface all library adapters must implement.

import type { ParsedTokenSet, ThemeTokens } from '../core/parser';

// ─── Token Categories ────────────────────────────────────────────────────────

export type TokenCategory =
    | 'colors'
    | 'spacing'
    | 'radius'
    | 'shadows'
    | 'blur'
    | 'typography'
    | 'opacity'
    | 'breakpoints'
    | 'containers'
    | 'fontWeights'
    | 'tracking'
    | 'leading'
    | 'maxWidth'
    | 'borderWidth'
    | 'skew';

export const ALL_CATEGORIES: TokenCategory[] = [
    'colors',
    'spacing',
    'radius',
    'shadows',
    'blur',
    'typography',
    'opacity',
    'breakpoints',
    'containers',
    'fontWeights',
    'tracking',
    'leading',
    'maxWidth',
    'borderWidth',
    'skew',
];

// ─── Adapter Interface ───────────────────────────────────────────────────────

export type AdapterType = 'primitives' | 'theme';

export interface LibraryAdapter {
    /** Unique identifier (e.g. "tailwindcss") */
    id: string;

    /** Display name (e.g. "Tailwind CSS") */
    name: string;

    /** Short description */
    description: string;

    /** Icon identifier for the UI */
    icon: string;

    /** GitHub repo URL */
    repoUrl: string;

    /** Adapter type: primitives (single mode) or theme (light/dark modes) */
    type: AdapterType;

    /** Dependencies that must be imported first (adapter IDs) */
    dependencies: string[];

    /** Default collection name */
    defaultCollectionName: string;

    /** Supported token categories */
    categories: TokenCategory[];

    /**
     * Fetch and parse all tokens.
     * For 'primitives' adapters: returns ParsedTokenSet
     * For 'theme' adapters: returns ThemeTokens
     */
    fetchAndParse(): Promise<PrimitiveResult | ThemeResult>;
}

export interface PrimitiveResult {
    type: 'primitives';
    tokens: ParsedTokenSet;
}

export interface ThemeResult {
    type: 'theme';
    tokens: ThemeTokens;
}

// ─── Preview Types ───────────────────────────────────────────────────────────

export interface PreviewNode {
    label: string;
    count: number;
    children?: PreviewNode[];
}

/**
 * Build a preview tree from a ParsedTokenSet for the UI.
 */
export function buildPreviewTree(tokens: ParsedTokenSet): PreviewNode[] {
    var nodes: PreviewNode[] = [];

    if (tokens.colors.length > 0) {
        // Group colors by their first path segment (palette name)
        var groups = new Map<string, number>();
        for (var i = 0; i < tokens.colors.length; i++) {
            var c = tokens.colors[i];
            var group = c.path[0];
            groups.set(group, (groups.get(group) || 0) + 1);
        }
        nodes.push({
            label: 'Colors',
            count: tokens.colors.length,
            children: Array.from(groups.entries()).map(function (entry) {
                return { label: entry[0], count: entry[1] };
            }),
        });
    }

    if (tokens.spacing.length > 0) {
        nodes.push({ label: 'Spacing', count: tokens.spacing.length });
    }
    if (tokens.radius.length > 0) {
        nodes.push({ label: 'Radius', count: tokens.radius.length });
    }
    if (tokens.shadows.length > 0) {
        nodes.push({ label: 'Shadows', count: tokens.shadows.length });
    }
    if (tokens.blur.length > 0) {
        nodes.push({ label: 'Blur', count: tokens.blur.length });
    }
    if (tokens.typography.length > 0) {
        nodes.push({ label: 'Typography', count: tokens.typography.length });
    }
    if (tokens.opacity.length > 0) {
        nodes.push({ label: 'Opacity', count: tokens.opacity.length });
    }
    if (tokens.breakpoints.length > 0) {
        nodes.push({ label: 'Breakpoints', count: tokens.breakpoints.length });
    }
    if (tokens.containers.length > 0) {
        nodes.push({ label: 'Containers', count: tokens.containers.length });
    }
    if (tokens.fontWeights.length > 0) {
        nodes.push({ label: 'Font Weights', count: tokens.fontWeights.length });
    }
    if (tokens.tracking.length > 0) {
        nodes.push({ label: 'Tracking', count: tokens.tracking.length });
    }
    if (tokens.leading.length > 0) {
        nodes.push({ label: 'Leading', count: tokens.leading.length });
    }
    if (tokens.maxWidth.length > 0) {
        nodes.push({ label: 'Max Width', count: tokens.maxWidth.length });
    }

    return nodes;
}

/**
 * Build a preview tree from theme tokens.
 */
export function buildThemePreviewTree(tokens: ThemeTokens): PreviewNode[] {
    var allKeys = new Set([
        ...Object.keys(tokens.light),
        ...Object.keys(tokens.dark),
    ]);

    return [
        {
            label: 'Theme Tokens',
            count: allKeys.size,
            children: [
                { label: 'Light Mode', count: Object.keys(tokens.light).length },
                { label: 'Dark Mode', count: Object.keys(tokens.dark).length },
            ],
        },
    ];
}
