// ─── Plugin Message Protocol ─────────────────────────────────────────────────
// Typed messages between UI iframe and Figma main thread.

import type { TokenCategory } from '../adapters/types';
import type { ImportProgress } from '../core/figmaSync';

// ─── UI → Main Thread ────────────────────────────────────────────────────────

export type UIMessage =
    | { type: 'IMPORT_TOKENS'; payload: ImportPayload }
    | { type: 'CLOSE' };

export interface ImportPayload {
    adapterIds: string[];
    collectionName: string;
    categories: TokenCategory[];
    /** For theme adapters: the primitives collection name for alias resolution */
    primitiveCollectionName?: string;
}

// ─── Main Thread → UI ────────────────────────────────────────────────────────

export type MainMessage =
    | { type: 'IMPORT_PROGRESS'; progress: ImportProgress }
    | { type: 'IMPORT_COMPLETE'; totalCreated: number }
    | { type: 'IMPORT_ERROR'; error: string };

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Send a typed message from UI to main thread. */
export function postToMain(msg: UIMessage): void {
    parent.postMessage({ pluginMessage: msg }, '*');
}

/** Send a typed message from main thread to UI. */
export function postToUI(msg: MainMessage): void {
    figma.ui.postMessage(msg);
}
