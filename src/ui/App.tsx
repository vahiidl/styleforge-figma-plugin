import React, { useEffect } from 'react';
import { useStore } from './store';
import Dashboard from './components/Dashboard';
import ConfigPanel from './components/ConfigPanel';
import ImportProgress from './components/ImportProgress';
import type { MainMessage, UIMessage } from '../shared/messaging';

export default function App() {
    const {
        view,
        setView,
        selectedLibraryIds,
        selectedCategories,
        collectionName,
        setError,
        setImportProgress,
        setSuccessMessage,
        reset,
    } = useStore();

    // ── Listen for messages from main thread ──
    useEffect(() => {
        const handler = (event: MessageEvent) => {
            const msg = event.data.pluginMessage as MainMessage;
            if (!msg) return;

            switch (msg.type) {
                case 'IMPORT_PROGRESS': {
                    const { current, total, phase, message } = msg.progress;
                    const pct = total > 0 ? Math.round((current / total) * 100) : 0;
                    setImportProgress(pct, phase, message);
                    break;
                }

                case 'IMPORT_COMPLETE':
                    setSuccessMessage(
                        `Successfully imported ${msg.totalCreated} tokens into your Figma file.`
                    );
                    break;

                case 'IMPORT_ERROR':
                    setError(msg.error);
                    break;
            }
        };

        window.addEventListener('message', handler);
        return () => window.removeEventListener('message', handler);
    }, [setError, setImportProgress, setSuccessMessage]);

    // ── Determine header title ──
    let headerTitle = 'StyleForge';
    let showBack = false;

    if (view === 'config') {
        headerTitle = 'Configure Import';
        showBack = true;
    } else if (view === 'importing') {
        headerTitle = 'Importing';
    }

    const handleBack = () => {
        if (view === 'config') {
            setView('dashboard');
        }
    };

    const handleImport = () => {
        if (selectedLibraryIds.length === 0) return;

        setView('importing');
        setError(null);
        setImportProgress(0, 'Starting...', 'Fetching tokens from GitHub...');

        const msg: UIMessage = {
            type: 'IMPORT_TOKENS',
            payload: {
                adapterIds: selectedLibraryIds,
                collectionName: collectionName, // Will fallback to default in code.ts if empty (for themes)
                categories: selectedCategories,
                primitiveCollectionName: 'TailwindCSS',
            },
        };

        parent.postMessage({ pluginMessage: msg }, '*');
    };

    return (
        <div className="app">
            {/* ── Header ── */}
            <div className="header">
                <div className="header-left">
                    {showBack ? (
                        <button className="header-back" onClick={handleBack}>
                            ← Back
                        </button>
                    ) : (
                        <div className="header-logo">SF</div>
                    )}
                    <span className="header-title">{headerTitle}</span>
                </div>
            </div>

            {/* ── Content ── */}
            <div className="content">
                {view === 'dashboard' && <Dashboard onImport={handleImport} />}

                {view === 'config' && <ConfigPanel onImport={handleImport} />}

                {view === 'importing' && <ImportProgress />}
            </div>
        </div>
    );
}
