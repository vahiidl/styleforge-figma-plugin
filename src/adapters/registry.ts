// ─── Adapter Registry ────────────────────────────────────────────────────────
// Central registry of all available library adapters.

import type { LibraryAdapter } from './types';
import { tailwindAdapter } from './tailwindAdapter';
import { shadcnAdapter } from './shadcnAdapter';
import { baseUiAdapter } from './baseUiAdapter';
import { cossAdapter } from './cossAdapter';
import { radixColorsAdapter } from './radixColorsAdapter';
import { muiAdapter } from './muiAdapter';
import { chakraAdapter } from './chakraAdapter';
import { mantineAdapter } from './mantineAdapter';
import { daisyuiAdapter } from './daisyuiAdapter';
import { bootstrapAdapter } from './bootstrapAdapter';

/** All registered adapters, keyed by ID. */
const adapters = new Map<string, LibraryAdapter>([
    [tailwindAdapter.id, tailwindAdapter],
    [shadcnAdapter.id, shadcnAdapter],
    [baseUiAdapter.id, baseUiAdapter],
    [cossAdapter.id, cossAdapter],
    [radixColorsAdapter.id, radixColorsAdapter],
    [muiAdapter.id, muiAdapter],
    [chakraAdapter.id, chakraAdapter],
    [mantineAdapter.id, mantineAdapter],
    [daisyuiAdapter.id, daisyuiAdapter],
    [bootstrapAdapter.id, bootstrapAdapter],
]);

/** Get all available adapters. */
export function getAllAdapters(): LibraryAdapter[] {
    return Array.from(adapters.values());
}

/** Get a specific adapter by ID. */
export function getAdapter(id: string): LibraryAdapter | undefined {
    return adapters.get(id);
}

/**
 * Get an adapter along with all its dependencies (in import order).
 * Dependencies come first in the returned array.
 */
export function getAdapterWithDeps(id: string): LibraryAdapter[] {
    const adapter = adapters.get(id);
    if (!adapter) return [];

    const result: LibraryAdapter[] = [];
    const visited = new Set<string>();

    function resolve(adapterId: string) {
        if (visited.has(adapterId)) return;
        visited.add(adapterId);

        const a = adapters.get(adapterId);
        if (!a) return;

        // Resolve dependencies first
        for (const depId of a.dependencies) {
            resolve(depId);
        }
        result.push(a);
    }

    resolve(id);
    return result;
}

/**
 * Get a list of unique adapters for the given IDs, with all dependencies resolved.
 * Ensures dependencies come before dependents.
 */
export function resolveAdapters(ids: string[]): LibraryAdapter[] {
    const result: LibraryAdapter[] = [];
    const visited = new Set<string>();

    function resolve(adapterId: string) {
        if (visited.has(adapterId)) return;
        visited.add(adapterId);

        const a = adapters.get(adapterId);
        if (!a) return;

        // Resolve dependencies first
        for (const depId of a.dependencies) {
            resolve(depId);
        }
        result.push(a);
    }

    for (const id of ids) {
        resolve(id);
    }
    return result;
}

/** Register a new adapter (for community extensions). */
export function registerAdapter(adapter: LibraryAdapter): void {
    adapters.set(adapter.id, adapter);
}
