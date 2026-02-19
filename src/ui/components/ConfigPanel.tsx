import React from 'react';
import { useStore } from '../store';
import { LIBRARIES } from '../libraryData';
import type { TokenCategory } from '../../adapters/types';

const CATEGORY_LABELS: Record<TokenCategory, string> = {
    colors: 'Colors',
    spacing: 'Spacing',
    radius: 'Radius',
    shadows: 'Shadows',
    blur: 'Blur',
    typography: 'Typography',
    opacity: 'Opacity',
    breakpoints: 'Breakpoints',
    containers: 'Containers',
    fontWeights: 'Font Weights',
    tracking: 'Tracking',
    leading: 'Leading',
};

interface Props {
    onImport: () => void;
}

export default function ConfigPanel({ onImport }: Props) {
    const {
        selectedLibraryIds,
        selectedCategories,
        toggleCategory,
        collectionName,
        setCollectionName,
    } = useStore();

    // Use Tailwind CSS definition for categories since it's the base
    const baseAdapter = LIBRARIES.find(lib => lib.id === 'tailwindcss');
    const categories = baseAdapter?.categories || [];

    // Get list of active themes for display
    const activeThemes = LIBRARIES.filter(
        lib => selectedLibraryIds.includes(lib.id) && lib.type === 'theme'
    );

    return (
        <>
            <div className="config-intro">
                <strong>Configuration</strong>
                <p>Tailwind CSS primitives will include:</p>
            </div>

            <div className="config-section">
                <div className="checkbox-list">
                    {categories.map(cat => (
                        <label
                            key={cat}
                            className={`checkbox-item ${selectedCategories.includes(cat) ? 'checked' : ''}`}
                        >
                            <span className="checkbox-indicator">
                                {selectedCategories.includes(cat) ? '✓' : ''}
                            </span>
                            {CATEGORY_LABELS[cat] || cat}
                            <input
                                type="checkbox"
                                checked={selectedCategories.includes(cat)}
                                onChange={() => toggleCategory(cat)}
                                style={{ display: 'none' }}
                            />
                        </label>
                    ))}
                </div>
            </div>

            {activeThemes.length > 0 && (
                <div className="dependency-notice">
                    <span className="dependency-notice-icon">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm-.75 4a.75.75 0 0 1 1.5 0v4a.75.75 0 0 1-1.5 0V5zm.75 7a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5z" /></svg>
                    </span>
                    <span>
                        Start import to also include tokens from: <strong>{activeThemes.map(t => t.name).join(', ')}</strong>.
                    </span>
                </div>
            )}



            <div className="footer" style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
                <button
                    className="btn btn-primary"
                    onClick={onImport}
                    disabled={selectedCategories.length === 0}
                >
                    Import {selectedLibraryIds.length} Libraries
                </button>
            </div>
        </>
    );
}
