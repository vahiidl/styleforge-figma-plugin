// ─── Tailwind CSS v4 Adapter ─────────────────────────────────────────────────
// Fetches the official Tailwind CSS v4 theme.css from GitHub and parses it
// into Figma-compatible primitive tokens.

import { fetchRawFromGitHub } from '../core/fetcher';
import { parseThemeBlock, categorizeTokens, extractCSSVariables } from '../core/parser';
import type { LibraryAdapter, PrimitiveResult, TokenCategory } from './types';

const TAILWIND_OWNER = 'tailwindlabs';
const TAILWIND_REPO = 'tailwindcss';
const TAILWIND_FILE = 'packages/tailwindcss/theme.css';
const TAILWIND_BRANCH = 'main';

export const tailwindAdapter: LibraryAdapter = {
    id: 'tailwindcss',
    name: 'Tailwind CSS',
    description: 'The complete Tailwind v4 design token palette, colors, spacing, radius, shadows, blur, typography, and more.',
    icon: 'tailwind',
    repoUrl: `https://github.com/${TAILWIND_OWNER}/${TAILWIND_REPO}`,
    type: 'primitives',
    dependencies: [],
    defaultCollectionName: 'TailwindCSS',
    categories: [
        'colors', 'spacing', 'radius', 'shadows', 'blur', 'typography',
        'opacity', 'breakpoints', 'containers', 'fontWeights', 'tracking', 'leading',
    ] as TokenCategory[],

    async fetchAndParse(): Promise<PrimitiveResult> {
        // Fetch the theme.css from GitHub
        const css = await fetchRawFromGitHub(
            TAILWIND_OWNER,
            TAILWIND_REPO,
            TAILWIND_FILE,
            TAILWIND_BRANCH
        );

        // Parse the @theme default { ... } block
        let vars = parseThemeBlock(css);

        // Fallback: if @theme block parsing fails, try extracting all variables
        if (vars.length === 0) {
            vars = extractCSSVariables(css);
        }

        // Categorize into typed token groups
        const tokens = categorizeTokens(vars);

        // ─── Inject Defaults (Phase 20) ───
        // Opacity 0-100 (integers)
        if (tokens.opacity.length < 101) {
            tokens.opacity = [];
            for (let i = 0; i <= 100; i++) {
                tokens.opacity.push({
                    path: [i.toString()],
                    value: i, // User requested integer value
                    rawValue: i.toString()
                });
            }
        }

        // Border Width (0, 1, 2, 4, 8)
        const borders = [0, 1, 2, 4, 8];
        borders.forEach(w => {
            const path = w === 0 ? ['0'] : w === 1 ? ['DEFAULT'] : [w.toString()];
            // Check formatted path? Or just value?
            // User screenshot shows '0', '1', '2', '4', '8'.
            if (!tokens.borderWidth.some(b => b.value === w)) {
                tokens.borderWidth.push({
                    path: [w.toString()],
                    value: w,
                    rawValue: w + 'px'
                });
            }
        });

        // Skew (0, 1, 2, 3, 6, 12)
        const skews = [0, 1, 2, 3, 6, 12];
        skews.forEach(s => {
            if (!tokens.skew.some(k => k.value === s)) {
                tokens.skew.push({
                    path: [s.toString()],
                    value: s, // degrees
                    rawValue: s.toString()
                });
            }
        });

        // Font Weights (100-900)
        const weightMap: Record<string, number> = {
            'thin': 100,
            'extralight': 200,
            'light': 300,
            'normal': 400,
            'medium': 500,
            'semibold': 600,
            'bold': 700,
            'extrabold': 800,
            'black': 900
        };
        Object.entries(weightMap).forEach(([key, val]) => {
            if (!tokens.fontWeights.some(t => t.path[0] === key)) {
                tokens.fontWeights.push({
                    path: [key],
                    value: val,
                    rawValue: val.toString()
                });
            }
        });

        // ─── Map Zinc to Neutral (Phase 24) ───
        // User requested consistency: replace logic for Zinc with Neutral
        // We'll find Neutral tokens and overwrite/alias Zinc tokens to match them.
        const neutralTokens = tokens.colors.filter(c => c.path[0] === 'neutral');
        if (neutralTokens.length > 0) {
            // Remove existing Zinc tokens
            tokens.colors = tokens.colors.filter(c => c.path[0] !== 'zinc');

            // Re-add Neutral tokens as Zinc
            neutralTokens.forEach(nt => {
                // Ensure deep copy to avoid path mutation issues
                const zincToken = { ...nt, path: ['zinc', ...nt.path.slice(1)] };
                tokens.colors.push(zincToken);
            });
        }

        // Tracking (tighter, tight, normal, wide, wider, widest)
        const trackingMap: Record<string, number> = {
            'tighter': -0.05,
            'tight': -0.025,
            'normal': 0,
            'wide': 0.025,
            'wider': 0.05,
            'widest': 0.1
        };
        Object.entries(trackingMap).forEach(([key, val]) => {
            if (!tokens.tracking.some(t => t.path[0] === key)) {
                tokens.tracking.push({
                    path: [key],
                    value: val,
                    rawValue: val.toString()
                });
            }
        });

        // Colors: Base (White, Black)
        if (!tokens.colors.some(c => c.path[0] === 'base')) {
            tokens.colors.push({
                path: ['base', 'white'],
                figmaColor: { r: 1, g: 1, b: 1, a: 1 },
                rawValue: '#FFFFFF'
            });
            tokens.colors.push({
                path: ['base', 'black'],
                figmaColor: { r: 0, g: 0, b: 0, a: 1 },
                rawValue: '#000000'
            });
        }

        return {
            type: 'primitives',
            tokens,
        };
    },
};
