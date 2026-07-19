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
    maxWidth: 'Max Width',
    borderWidth: 'Border Width',
    skew: 'Skew',
};

interface Props {
    onImport: () => void;
}

export default function ConfigPanel({ onImport }: Props) {
    const {
        selectedLibraryIds,
        selectedCategories,
        toggleCategory,
        adapterConfigs,
        setAdapterConfig,
        multiMode,
    } = useStore();

    // Use Tailwind CSS definition for categories since it's the base
    const baseAdapter = LIBRARIES.find(lib => lib.id === 'tailwindcss');
    const categories = (baseAdapter?.categories || []) as TokenCategory[];
    const tailwindSelected = selectedLibraryIds.includes('tailwindcss');

    // Adapters with configurable options among the selection
    const configurable = LIBRARIES.filter(
        lib => selectedLibraryIds.includes(lib.id) && lib.configOptions && lib.configOptions.length > 0
    );

    const activeThemes = LIBRARIES.filter(
        lib => selectedLibraryIds.includes(lib.id) && lib.type === 'theme'
    );

    return (
        <>
            {tailwindSelected && (
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
                </>
            )}

            {configurable.map(lib => (
                <div className="config-section" key={lib.id}>
                    <div className="config-label">{lib.name}</div>
                    {lib.configOptions!.map(opt => (
                        <div key={String(opt.key)} style={{ marginBottom: 10 }}>
                            <div className="config-sublabel">{opt.label}</div>
                            {opt.type === 'select' && (
                                <div className="select-wrap">
                                    <select
                                        className="config-input"
                                        value={adapterConfigs[lib.id]?.[opt.key] ?? opt.choices?.[0]?.value ?? ''}
                                        onChange={e => setAdapterConfig(lib.id, opt.key, e.target.value)}
                                    >
                                        {opt.choices?.map(c => (
                                            <option key={c.value} value={c.value}>{c.label}</option>
                                        ))}
                                    </select>
                                    <svg className="select-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            ))}

            {activeThemes.length > 0 && multiMode === false && (
                <div className="dependency-notice notice-warning">
                    <span className="dependency-notice-icon">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8.982 1.566a1.13 1.13 0 0 0-1.964 0L.165 13.233c-.457.778.091 1.767.982 1.767h13.706c.89 0 1.438-.99.982-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/></svg>
                    </span>
                    <span>
                        <strong>This file&rsquo;s plan supports one variable mode.</strong> Theme
                        libraries will import <strong>Light mode values only</strong> — Dark values
                        are skipped. Upgrade the file&rsquo;s team plan to get Light/Dark modes.
                    </span>
                </div>
            )}

            {activeThemes.length > 0 && (
                <div className="dependency-notice">
                    <span className="dependency-notice-icon">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm-.75 4a.75.75 0 0 1 1.5 0v4a.75.75 0 0 1-1.5 0V5zm.75 7a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5z" /></svg>
                    </span>
                    <span>
                        Theme collections included: <strong>{activeThemes.map(t => t.name).join(', ')}</strong>.
                    </span>
                </div>
            )}

            <div className="sticky-footer">
                <button
                    className="btn btn-primary"
                    onClick={onImport}
                    disabled={selectedCategories.length === 0}
                >
                    Import {selectedLibraryIds.length} {selectedLibraryIds.length === 1 ? 'Library' : 'Libraries'}
                </button>
            </div>
        </>
    );
}
