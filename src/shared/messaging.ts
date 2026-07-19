// ─── Plugin Message Protocol ─────────────────────────────────────────────────
// Typed messages between UI iframe and Figma main thread.

import type { AdapterConfig, TokenCategory, SourceInfo } from '../adapters/types';
import type { ImportProgress } from '../core/figmaSync';
import type { CollectionDiff } from '../core/diffEngine';

// ─── UI → Main Thread ────────────────────────────────────────────────────────

export type UIMessage =
    | { type: 'IMPORT_TOKENS'; payload: ImportPayload }
    | { type: 'REQUEST_DIFF'; payload: ImportPayload }
    | { type: 'EXPORT_TOKENS' }
    | { type: 'CLOSE' };

export interface ImportPayload {
    adapterIds: string[];
    collectionName: string;
    categories: TokenCategory[];
    /** For theme adapters: the primitives collection name for alias resolution */
    primitiveCollectionName?: string;
    /** Per-adapter user configuration (base color, accent, pasted JSON, ...) */
    adapterConfigs?: Record<string, AdapterConfig>;
}

// ─── Main Thread → UI ────────────────────────────────────────────────────────

export type MainMessage =
    | { type: 'CAPABILITIES'; multiMode: boolean }
    | { type: 'IMPORT_PROGRESS'; progress: ImportProgress }
    | { type: 'IMPORT_COMPLETE'; totalCreated: number; sources: AdapterSource[]; modesLimited: boolean }
    | { type: 'IMPORT_ERROR'; error: string }
    | { type: 'DIFF_RESULT'; diffs: CollectionDiff[]; sources: AdapterSource[] }
    | { type: 'DIFF_ERROR'; error: string }
    | { type: 'EXPORT_RESULT'; json: string; css: string }
    | { type: 'EXPORT_ERROR'; error: string };

export interface AdapterSource {
    adapterId: string;
    source?: SourceInfo;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Send a typed message from UI to main thread. */
export function postToMain(msg: UIMessage): void {
    parent.postMessage({ pluginMessage: msg }, '*');
}

/** Send a typed message from main thread to UI. */
export function postToUI(msg: MainMessage): void {
    figma.ui.postMessage(msg);
}
