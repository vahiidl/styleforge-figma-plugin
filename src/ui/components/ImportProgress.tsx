import React from 'react';
import { useStore } from '../store';

export default function ImportProgress() {
    const { importProgress, importPhase, importMessage, successMessage, error, reset } =
        useStore();

    if (successMessage) {
        return (
            <div className="result-container">
                <div className="result-icon success">✓</div>
                <div className="result-title">Import Complete!</div>
                <div className="result-message">{successMessage}</div>
                <button className="btn btn-primary" onClick={reset} style={{ marginTop: 8 }}>
                    Back
                </button>
            </div>
        );
    }

    if (error) {
        return (
            <div className="result-container">
                <div className="result-icon error">✕</div>
                <div className="result-title">Import Failed</div>
                <div className="result-message">{error}</div>
                <button className="btn btn-secondary" onClick={reset} style={{ marginTop: 8 }}>
                    Try Again
                </button>
            </div>
        );
    }

    return (
        <div className="progress-container">
            <div className="spinner" />
            <div className="progress-phase">{importPhase || 'Preparing...'}</div>
            <div className="progress-bar-track">
                <div
                    className="progress-bar-fill"
                    style={{ width: `${Math.min(importProgress, 100)}%` }}
                />
            </div>
            <div className="progress-message">{importMessage}</div>
        </div>
    );
}
