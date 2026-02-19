// ─── Zustand Store ───────────────────────────────────────────────────────────

import { create } from 'zustand';
import type { TokenCategory } from '../adapters/types';

export type AppView = 'dashboard' | 'config' | 'importing';

interface AdapterInfo {
    id: string;
    name: string;
    description: string;
    icon: string;
    type: 'primitives' | 'theme';
    dependencies: string[];
    categories: TokenCategory[];
    defaultCollectionName: string;
}

interface StoreState {
    // Navigation
    view: AppView;
    setView: (view: AppView) => void;

    // Library selection
    selectedLibraryIds: string[];
    toggleLibrary: (id: string) => void;
    setLibrarySelected: (id: string, selected: boolean) => void;

    // Configuration (Applied to Tailwind base)
    selectedCategories: TokenCategory[];
    toggleCategory: (cat: TokenCategory) => void;
    setSelectedCategories: (cats: TokenCategory[]) => void;
    collectionName: string;
    setCollectionName: (name: string) => void;

    // Import progress
    importProgress: number;
    importPhase: string;
    importMessage: string;
    setImportProgress: (progress: number, phase: string, message: string) => void;

    // Errors & status
    error: string | null;
    setError: (error: string | null) => void;
    successMessage: string | null;
    setSuccessMessage: (msg: string | null) => void;

    // Search
    searchQuery: string;
    setSearchQuery: (query: string) => void;

    // Reset
    reset: () => void;
}

export const useStore = create<StoreState>((set) => ({
    view: 'dashboard',
    setView: (view) => set({ view }),

    selectedLibraryIds: ['tailwindcss'],

    toggleLibrary: (id) => set((state) => {
        // Tailwind is always selected
        if (id === 'tailwindcss') return state;

        const isSelected = state.selectedLibraryIds.includes(id);
        const newIds = isSelected
            ? state.selectedLibraryIds.filter(libId => libId !== id)
            : [...state.selectedLibraryIds, id];

        return { selectedLibraryIds: newIds };
    }),

    setLibrarySelected: (id, selected) => set((state) => {
        if (id === 'tailwindcss') return state;
        if (selected && !state.selectedLibraryIds.includes(id)) {
            return { selectedLibraryIds: [...state.selectedLibraryIds, id] };
        }
        if (!selected && state.selectedLibraryIds.includes(id)) {
            return { selectedLibraryIds: state.selectedLibraryIds.filter(libId => libId !== id) };
        }
        return state;
    }),

    // Default categories for Tailwind
    selectedCategories: [
        'colors', 'spacing', 'radius', 'shadows', 'blur', 'typography',
        'opacity', 'breakpoints', 'containers', 'fontWeights', 'tracking', 'leading', 'maxWidth', 'borderWidth', 'skew',
    ],

    toggleCategory: (cat) =>
        set((state) => ({
            selectedCategories: state.selectedCategories.includes(cat)
                ? state.selectedCategories.filter((c) => c !== cat)
                : [...state.selectedCategories, cat],
        })),
    setSelectedCategories: (cats) => set({ selectedCategories: cats }),

    collectionName: '',
    setCollectionName: (name) => set({ collectionName: name }),

    importProgress: 0,
    importPhase: '',
    importMessage: '',
    setImportProgress: (progress, phase, message) =>
        set({ importProgress: progress, importPhase: phase, importMessage: message }),

    error: null,
    setError: (error) => set({ error }),

    successMessage: null,
    setSuccessMessage: (msg) => set({ successMessage: msg }),

    searchQuery: '',
    setSearchQuery: (query) => set({ searchQuery: query }),

    reset: () =>
        set({
            view: 'dashboard',
            selectedLibraryIds: ['tailwindcss'],
            // Keep default Tailwind categories selected
            selectedCategories: [
                'colors', 'spacing', 'radius', 'shadows', 'blur', 'typography',
                'opacity', 'breakpoints', 'containers', 'fontWeights', 'tracking', 'leading', 'maxWidth', 'borderWidth', 'skew',
            ],
            collectionName: '',
            importProgress: 0,
            importPhase: '',
            importMessage: '',
            error: null,
            successMessage: null,
            searchQuery: '',
        }),
}));
