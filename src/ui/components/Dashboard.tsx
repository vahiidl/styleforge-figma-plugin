import React from 'react';
import { useStore } from '../store';
import LibraryCard from './LibraryCard';
import { LIBRARIES } from '../libraryData';

interface DashboardProps {
    onContinue: () => void;
}

export default function Dashboard({ onContinue }: DashboardProps) {
    const {
        selectedLibraryIds,
        toggleLibrary,
        setCollectionName,
    } = useStore();

    const handleContinue = () => {
        // Find the "primary" adapter for default collection name
        const selectedThemes = LIBRARIES.filter(lib =>
            selectedLibraryIds.includes(lib.id) && lib.type === 'theme'
        );

        if (selectedThemes.length > 0) {
            setCollectionName(selectedThemes[0].defaultCollectionName);
        } else {
            setCollectionName('TailwindCSS');
        }

        onContinue();
    };

    const tailwindLib = LIBRARIES.find(l => l.id === 'tailwindcss');
    const otherLibs = LIBRARIES.filter(l => l.id !== 'tailwindcss');

    return (
        <div className="dashboard-container">
            <header className="dashboard-header" style={{ alignItems: 'flex-start', textAlign: 'left', paddingBottom: '0' }}>
                <h1 className="dashboard-title" style={{ textAlign: 'left', marginBottom: '8px' }}>Design Tokens</h1>
                <p className="dashboard-description" style={{ textAlign: 'left', marginBottom: '16px' }}>
                    Tailwind CSS is required to import primitives.
                </p>
            </header>

            <div className="library-list">
                {tailwindLib && (
                    <LibraryCard
                        key={tailwindLib.id}
                        id={tailwindLib.id}
                        name={tailwindLib.name}
                        description={tailwindLib.description}
                        iconSrc={tailwindLib.iconSrc}
                        selected={selectedLibraryIds.includes(tailwindLib.id)}
                        onToggle={() => toggleLibrary(tailwindLib.id)}
                        locked={true}
                    />
                )}

                <div style={{ marginTop: '16px', marginBottom: '8px', fontSize: '13px', color: 'var(--sf-text-secondary)', lineHeight: 1.4 }}>
                    Add design systems to import alongside the primitives:
                </div>

                {otherLibs.map((lib) => (
                    <LibraryCard
                        key={lib.id}
                        id={lib.id}
                        name={lib.name}
                        description={lib.description}
                        iconSrc={lib.iconSrc}
                        selected={selectedLibraryIds.includes(lib.id)}
                        onToggle={() => toggleLibrary(lib.id)}
                        locked={false}
                    />
                ))}
            </div>

            <footer className="sticky-footer">
                <button
                    className="btn btn-primary btn-full"
                    onClick={handleContinue}
                    disabled={selectedLibraryIds.length === 0}
                >
                    Continue
                </button>
            </footer>
        </div>
    );
}
