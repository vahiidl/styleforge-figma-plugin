import tailwindIcon from './img/tailwindcss.png';
import shadcnIcon from './img/shadcn.png';
import baseUiIcon from './img/baseui.png';
import cossIcon from './img/coss.png';

export const LIBRARIES = [
    {
        id: 'tailwindcss',
        name: 'Tailwind CSS',
        description: 'Complete v4 token palette, colors, spacing, radius, shadows, typography, breakpoints.',
        iconSrc: tailwindIcon,
        type: 'primitives' as const,
        dependencies: [] as string[],
        categories: [
            'colors', 'spacing', 'radius', 'shadows', 'blur', 'typography',
            'opacity', 'breakpoints', 'containers', 'fontWeights', 'tracking', 'leading',
        ] as const,
        defaultCollectionName: 'TailwindCSS',
    },
    {
        id: 'shadcn',
        name: 'Shadcn UI',
        description: 'Semantic theme tokens with Light/Dark modes.',
        iconSrc: shadcnIcon,
        type: 'theme' as const,
        dependencies: ['tailwindcss'],
        categories: ['colors'] as const,
        defaultCollectionName: 'Theme',
    },
    {
        id: 'base-ui',
        name: 'Base UI',
        description: 'Semantic & syntax colors, Light/Dark modes.',
        iconSrc: baseUiIcon,
        type: 'theme' as const,
        dependencies: ['tailwindcss'],
        categories: ['colors'] as const,
        defaultCollectionName: 'Base UI',
    },
    {
        id: 'coss',
        name: 'Coss.com',
        description: 'Semantic color & radius tokens, Light/Dark modes.',
        iconSrc: cossIcon,
        type: 'theme' as const,
        dependencies: ['tailwindcss'],
        categories: ['colors', 'radius'] as const,
        defaultCollectionName: 'Coss',
    },
];
