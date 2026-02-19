# StyleForge - Figma Plugin

> Import design tokens from popular CSS frameworks directly into Figma variables and styles.

![License](https://img.shields.io/badge/license-MIT-blue)
![Platform](https://img.shields.io/badge/platform-Figma-blueviolet)

## What It Does

StyleForge bridges the gap between code and design. It fetches, parses, and imports design tokens from popular CSS frameworks directly into Figma - no manual data entry, no JSON uploads.

### Supported Libraries

| Library | Type | Collection | What Gets Imported |
|---------|------|------------|-------------------|
| **Tailwind CSS v4** | Primitives | TailwindCSS | Colors, spacing, radius, shadows, blur, typography matrix (size x weight), breakpoints, containers, font weights, tracking, leading, opacity |
| **Shadcn UI** | Theme (Light/Dark) | Theme | Semantic tokens (background, primary, muted, etc.) aliased to Tailwind primitives |
| **Base UI** | Theme (Light/Dark) | Base UI | Semantic and syntax colors for unstyled components |
| **Coss.com** | Theme (Light/Dark) | Coss | Semantic colors, info/success/warning status tokens, radius |

## Features

- **Direct Import** - Select a library, pick categories, and import
- **Source of Truth** - Tailwind tokens fetched live from GitHub; theme tokens from curated local JSON
- **Smart Aliasing** - Theme tokens automatically alias to Tailwind primitive variables when colors match
- **Light/Dark Modes** - Theme adapters create proper Figma variable modes
- **Dependency Resolution** - Theme adapters auto-import Tailwind primitives first
- **Extensible** - Adapter pattern makes adding new libraries straightforward
- **Color Conversion** - Handles oklch, HSL, RGB, rgba, and HEX to Figma RGBA
- **Smart Mapping** - Automatically maps Zinc colors to Neutral for consistent Shadcn/Coss themes
- **Text Styles** - Generates complete typography matrix (Size × Weight) with 100-900 font weights
- **Effect Styles** - Grouped Shadows, Layer Blurs, and generated Backdrop Blurs

## Installation

### For Users
*(Coming soon)* Install from the Figma Community

### For Developers

```bash
git clone https://github.com/your-username/styleforge-figma-plugin.git
cd styleforge-figma-plugin
npm install
npm run build
```

Then in Figma:
1. Open the Figma desktop app
2. Go to **Plugins > Development > Import plugin from manifest...**
3. Select the `manifest.json` file from this project

Development watch mode:
```bash
npm run dev
```

## Architecture

```
src/
├── adapters/                   # Library adapters
│   ├── types.ts                # Adapter interface & preview types
│   ├── tailwindAdapter.ts      # Tailwind CSS v4 (live fetch from GitHub)
│   ├── shadcnAdapter.ts        # Shadcn UI (local JSON fallback)
│   ├── baseUiAdapter.ts        # Base UI (local JSON)
│   ├── cossAdapter.ts          # Coss.com (local JSON)
│   └── registry.ts             # Adapter registry with dependency resolution
├── core/
│   ├── colorUtils.ts           # oklch/HSL/HEX/RGB → Figma RGBA conversion
│   ├── fetcher.ts              # GitHub raw content fetcher with caching
│   ├── parser.ts               # CSS variable parser & token categorizer
│   ├── jsonTokenParser.ts      # Flat JSON token parser (Light/Dark modes)
│   ├── variableManager.ts      # Figma Variable/Collection management
│   └── figmaSync.ts            # Import orchestration engine
├── data/                       # Local token JSON files
│   ├── base-ui.tokens.json     # Base UI design tokens
│   ├── coss.tokens.json        # Coss.com design tokens
│   ├── shadcn-light.tokens.json # Shadcn UI light mode tokens
│   └── shadcn-dark.tokens.json  # Shadcn UI dark mode tokens
├── shared/
│   └── messaging.ts            # Typed UI ↔ main thread messages
├── ui/
│   ├── components/
│   │   ├── Dashboard.tsx       # Library selector with search
│   │   ├── LibraryCard.tsx     # Library card component
│   │   ├── ConfigPanel.tsx     # Import configuration & CTA
│   │   └── ImportProgress.tsx  # Progress & result states
│   ├── App.tsx                 # Root app with view routing
│   ├── store.ts                # Zustand state management
│   ├── styles.css              # Plugin UI stylesheet
│   ├── main.tsx                # React entry point
│   └── index.html              # HTML entry
└── code.ts                     # Figma main thread entry
```

## Adding a New Adapter

1. Create a new file in `src/adapters/` (e.g., `myLibAdapter.ts`)
2. Implement the `LibraryAdapter` interface:

```typescript
import type { LibraryAdapter, ThemeResult, TokenCategory } from './types';
import { parseJsonTokens } from '../core/jsonTokenParser';
import myTokens from '../data/my-lib.tokens.json';

export const myLibAdapter: LibraryAdapter = {
  id: 'mylib',
  name: 'My Library',
  description: 'Description of your library',
  icon: 'mylib',
  repoUrl: 'https://github.com/org/repo',
  type: 'theme',
  dependencies: ['tailwindcss'],
  defaultCollectionName: 'My Lib',
  categories: ['colors'] as TokenCategory[],

  async fetchAndParse(): Promise<ThemeResult> {
    const { light, dark } = parseJsonTokens(myTokens as Record<string, any>);
    return { type: 'theme', tokens: { light, dark } };
  },
};
```

3. Add your token JSON file to `src/data/`
4. Register the adapter in `src/adapters/registry.ts`
5. Add a card entry in `src/ui/components/Dashboard.tsx`

## Token Sources

| Library | Source | Format |
|---------|--------|--------|
| Tailwind CSS v4 | Live from `github.com/tailwindlabs/tailwindcss` | CSS `@theme` block |
| Shadcn UI | Local JSON (`src/data/shadcn-*.tokens.json`) | oklch values from [ui.shadcn.com/docs/theming](https://ui.shadcn.com/docs/theming) |
| Base UI | Local JSON (`src/data/base-ui.tokens.json`) | Hex/rgba from Base UI Figma variables |
| Coss.com | Local JSON (`src/data/coss.tokens.json`) | Hex/rgba from [coss.com/ui](https://coss.com/ui) design tokens |

## License

MIT - see [LICENSE](LICENSE) for details.

## Contributing

Contributions are welcome. See the adapter pattern above for adding new library support.

1. Fork the repository
2. Create your feature branch (`git checkout -b feat/new-library`)
3. Commit your changes
4. Open a Pull Request
