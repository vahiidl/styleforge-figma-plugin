import React, { useEffect } from 'react';
import { useStore } from './store';
import Dashboard from './components/Dashboard';
import ConfigPanel from './components/ConfigPanel';
import ImportProgress from './components/ImportProgress';
import type { MainMessage, UIMessage, ImportPayload } from '../shared/messaging';

export default function App() {
    const {
        view,
        setView,
        selectedLibraryIds,
        selectedCategories,
        collectionName,
        adapterConfigs,
        setError,
        setImportProgress,
        setSuccessMessage,
        setMultiMode,
    } = useStore();

    const buildPayload = (): ImportPayload => ({
        adapterIds: selectedLibraryIds,
        collectionName,
        categories: selectedCategories,
        primitiveCollectionName: 'TailwindCSS',
        adapterConfigs,
    });

    // ── Listen for messages from main thread ──
    useEffect(() => {
        const handler = (event: MessageEvent) => {
            const msg = event.data.pluginMessage as MainMessage;
            if (!msg) return;

            switch (msg.type) {
                case 'CAPABILITIES':
                    setMultiMode(msg.multiMode);
                    break;

                case 'IMPORT_PROGRESS': {
                    const { current, total, phase, message } = msg.progress;
                    const pct = total > 0 ? Math.round((current / total) * 100) : 0;
                    setImportProgress(pct, phase, message);
                    break;
                }

                case 'IMPORT_COMPLETE': {
                    const live = msg.sources.filter(s => s.source?.kind === 'live').length;
                    const suffix = msg.sources.length > 0
                        ? live > 0
                            ? ` ${live} of ${msg.sources.length} sources fetched live from upstream.`
                            : ' Imported from bundled snapshots (offline).'
                        : '';
                    const modeNote = msg.modesLimited
                        ? ' Light mode only — this file\u2019s plan allows a single variable mode, so Dark values were skipped.'
                        : '';
                    setSuccessMessage(
                        `Successfully imported ${msg.totalCreated} tokens into your Figma file.${modeNote}${suffix}`
                    );
                    break;
                }

                case 'IMPORT_ERROR':
                    setError(msg.error);
                    break;
            }
        };

        window.addEventListener('message', handler);
        return () => window.removeEventListener('message', handler);
    }, [setError, setImportProgress, setSuccessMessage, setMultiMode]);

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
        if (view === 'config') setView('dashboard');
    };

    const handleImport = () => {
        const payload = buildPayload();
        if (payload.adapterIds.length === 0) return;

        setView('importing');
        setError(null);
        setImportProgress(0, 'Starting...', 'Fetching tokens...');

        const msg: UIMessage = { type: 'IMPORT_TOKENS', payload };
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
                {view === 'dashboard' && <Dashboard onContinue={() => setView('config')} />}

                {view === 'config' && <ConfigPanel onImport={handleImport} />}

                {view === 'importing' && <ImportProgress />}
            </div>
        </div>
    );
}
