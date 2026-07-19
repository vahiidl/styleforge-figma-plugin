import tailwindIcon from './img/tailwindcss.png';
import shadcnIcon from './img/shadcn.png';
import baseUiIcon from './img/baseui.png';
import cossIcon from './img/coss.png';
import type { AdapterConfigOption } from '../adapters/types';

export interface LibraryEntry {
    id: string;
    name: string;
    description: string;
    /** PNG icon; libraries without one render a letter tile. */
    iconSrc?: string;
    type: 'primitives' | 'theme';
    dependencies: string[];
    categories: readonly string[];
    defaultCollectionName: string;
    configOptions?: AdapterConfigOption[];
}

const SHADCN_BASE_COLORS = ['neutral', 'stone', 'zinc', 'mauve', 'olive', 'mist', 'taupe'];
const SHADCN_ACCENTS = [
    'amber', 'blue', 'cyan', 'emerald', 'fuchsia', 'green', 'indigo', 'lime',
    'orange', 'pink', 'purple', 'red', 'rose', 'sky', 'teal', 'violet', 'yellow',
];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const LIBRARIES: LibraryEntry[] = [
    {
        id: 'tailwindcss',
        name: 'Tailwind CSS',
        description: 'Complete v4 token palette, colors, spacing, radius, shadows, typography, breakpoints.',
        iconSrc: tailwindIcon,
        type: 'primitives',
        dependencies: [],
        categories: [
            'colors', 'spacing', 'radius', 'shadows', 'blur', 'typography',
            'opacity', 'breakpoints', 'containers', 'fontWeights', 'tracking', 'leading',
        ],
        defaultCollectionName: 'TailwindCSS',
    },
    {
        id: 'shadcn',
        name: 'Shadcn UI',
        description: 'Current default theme, pick a base color and accent. Light/Dark, radius scale, state recipes, shadows.',
        iconSrc: shadcnIcon,
        type: 'theme',
        dependencies: ['tailwindcss'],
        categories: ['colors', 'radius', 'shadows'],
        defaultCollectionName: 'Shadcn',
        configOptions: [
            { key: 'baseColor', label: 'Base color', type: 'select', choices: SHADCN_BASE_COLORS.map(c => ({ value: c, label: cap(c) })) },
            { key: 'accent', label: 'Accent theme', type: 'select', choices: [{ value: '', label: 'None (base only)' }, ...SHADCN_ACCENTS.map(c => ({ value: c, label: cap(c) }))] },
        ],
    },
    {
        id: 'base-ui',
        name: 'Base UI',
        description: 'Semantic & syntax colors, Light/Dark modes.',
        iconSrc: baseUiIcon,
        type: 'theme',
        dependencies: ['tailwindcss'],
        categories: ['colors'],
        defaultCollectionName: 'Base UI',
    },
    {
        id: 'coss',
        name: 'Coss.com',
        description: 'Semantic color & radius tokens, Light/Dark modes.',
        iconSrc: cossIcon,
        type: 'theme',
        dependencies: ['tailwindcss'],
        categories: ['colors', 'radius'],
        defaultCollectionName: 'Coss',
    },
    {
        id: 'radix-colors',
        name: 'Radix Colors',
        description: 'All Radix scales (12 steps, solid + alpha) with true Light/Dark pairs.',
        type: 'theme',
        dependencies: [],
        categories: ['colors'],
        defaultCollectionName: 'Radix Colors',
    },
    {
        id: 'mui',
        name: 'Material UI',
        description: 'Default palette (Light/Dark), spacing, radius, elevation shadows, typography ramp.',
        type: 'theme',
        dependencies: [],
        categories: ['colors', 'spacing', 'radius', 'shadows', 'typography'],
        defaultCollectionName: 'Material UI',
    },
    {
        id: 'chakra',
        name: 'Chakra UI',
        description: 'Default theme: color scales, spacing, radii, font sizes/weights, shadows.',
        type: 'primitives',
        dependencies: [],
        categories: ['colors', 'spacing', 'radius', 'shadows', 'typography', 'fontWeights'],
        defaultCollectionName: 'Chakra UI',
    },
    {
        id: 'mantine',
        name: 'Mantine',
        description: 'Default theme: 10-step color scales, spacing, radius, font sizes, shadows.',
        type: 'primitives',
        dependencies: [],
        categories: ['colors', 'spacing', 'radius', 'shadows', 'typography'],
        defaultCollectionName: 'Mantine',
    },
    {
        id: 'daisyui',
        name: 'DaisyUI',
        description: 'Built-in light & dark themes: primary/secondary/accent/base plus radius tokens.',
        type: 'theme',
        dependencies: [],
        categories: ['colors', 'radius'],
        defaultCollectionName: 'DaisyUI',
    },
    {
        id: 'bootstrap',
        name: 'Bootstrap 5',
        description: 'The --bs-* palette: brand & gray scales, semantic body/link/border colors, Light/Dark.',
        type: 'theme',
        dependencies: [],
        categories: ['colors'],
        defaultCollectionName: 'Bootstrap',
    },
];
