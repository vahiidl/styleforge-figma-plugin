// ─── Figma Variable Manager ──────────────────────────────────────────────────
// Handles creation and management of Figma Variable Collections, Variables,
// and alias resolution between Primitives and Theme collections.

import type { FigmaColor } from './colorUtils';
import { colorsMatch } from './colorUtils';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CollectionInfo {
    collection: VariableCollection;
    modeIds: Record<string, string>; // e.g. { "Light": "mode-id-1", "Dark": "mode-id-2" }
}

export interface VariableEntry {
    variable: Variable;
    collection: VariableCollection;
}

// ─── Collection Management ───────────────────────────────────────────────────

/**
 * Find an existing collection by name or create a new one.
 */
export function findOrCreateCollection(name: string): CollectionInfo {
    const existing = figma.variables
        .getLocalVariableCollections()
        .find((c: VariableCollection) => c.name === name);

    if (existing) {
        const modeIds: Record<string, string> = {};
        for (const mode of existing.modes) {
            modeIds[mode.name] = mode.modeId;
        }
        return { collection: existing, modeIds };
    }

    const collection = figma.variables.createVariableCollection(name);
    const modeIds: Record<string, string> = {};
    for (const mode of collection.modes) {
        modeIds[mode.name] = mode.modeId;
    }
    return { collection, modeIds };
}

/**
 * Ensure a collection has the required modes (e.g. "Light" and "Dark").
 * Renames the default mode if needed and adds missing modes.
 */
export function ensureModes(
    info: CollectionInfo,
    modeNames: string[]
): CollectionInfo {
    const { collection } = info;
    const modeIds: Record<string, string> = {};

    // Rename existing default mode to the first requested mode name
    if (modeNames.length > 0 && collection.modes.length > 0) {
        const firstMode = collection.modes[0];
        if (firstMode.name !== modeNames[0]) {
            collection.renameMode(firstMode.modeId, modeNames[0]);
        }
        modeIds[modeNames[0]] = firstMode.modeId;
    }

    // Add additional modes
    for (let i = 1; i < modeNames.length; i++) {
        const existingMode = collection.modes.find((m: { name: string; modeId: string }) => m.name === modeNames[i]);
        if (existingMode) {
            modeIds[modeNames[i]] = existingMode.modeId;
        } else {
            const newModeId = collection.addMode(modeNames[i]);
            modeIds[modeNames[i]] = newModeId;
        }
    }

    return { collection, modeIds };
}

// ─── Variable Creation ───────────────────────────────────────────────────────

/**
 * Find an existing variable by name in a collection, or create a new one.
 */
export function findOrCreateVariable(
    collection: VariableCollection,
    name: string,
    type: VariableResolvedDataType
): Variable {
    const existing = figma.variables
        .getLocalVariables(type)
        .find((v: Variable) => v.name === name && v.variableCollectionId === collection.id);

    if (existing) return existing;

    return figma.variables.createVariable(name, collection, type);
}

/**
 * Create a color variable and set its value for a given mode.
 */
export function setColorVariable(
    collection: VariableCollection,
    modeId: string,
    name: string,
    color: FigmaColor
): Variable {
    const variable = findOrCreateVariable(collection, name, 'COLOR');
    variable.setValueForMode(modeId, color);
    return variable;
}

/**
 * Create a float variable and set its value for a given mode.
 */
export function setFloatVariable(
    collection: VariableCollection,
    modeId: string,
    name: string,
    value: number
): Variable {
    const variable = findOrCreateVariable(collection, name, 'FLOAT');
    variable.setValueForMode(modeId, value);
    return variable;
}

/**
 * Create a string variable and set its value for a given mode.
 */
export function setStringVariable(
    collection: VariableCollection,
    modeId: string,
    name: string,
    value: string
): Variable {
    const variable = findOrCreateVariable(collection, name, 'STRING');
    variable.setValueForMode(modeId, value);
    return variable;
}

/**
 * Set a variable as an alias to another variable for a given mode.
 */
export function setVariableAlias(
    variable: Variable,
    modeId: string,
    target: Variable
): void {
    variable.setValueForMode(modeId, {
        type: 'VARIABLE_ALIAS',
        id: target.id,
    });
}

// ─── Alias Resolution ────────────────────────────────────────────────────────

/**
 * Given a color value, find a matching primitive variable by comparing values.
 * Returns the matching Variable if found, null otherwise.
 */
export function resolveColorAlias(
    color: FigmaColor,
    primitiveVariables: Variable[],
    primitiveModeId: string
): Variable | null {
    for (const pv of primitiveVariables) {
        if (pv.resolvedType !== 'COLOR') continue;
        const val = pv.valuesByMode[primitiveModeId];
        if (
            val &&
            typeof val === 'object' &&
            'r' in val &&
            colorsMatch(val as FigmaColor, color)
        ) {
            return pv;
        }
    }
    return null;
}

/**
 * Given a float value, find a matching primitive variable.
 */
export function resolveFloatAlias(
    value: number,
    primitiveVariables: Variable[],
    primitiveModeId: string,
    tolerance = 0.01
): Variable | null {
    for (const pv of primitiveVariables) {
        if (pv.resolvedType !== 'FLOAT') continue;
        const val = pv.valuesByMode[primitiveModeId];
        if (typeof val === 'number' && Math.abs(val - value) < tolerance) {
            return pv;
        }
    }
    return null;
}

// ─── Batch Variable Lookup ───────────────────────────────────────────────────

/**
 * Get all local variables from a specific collection.
 */
export function getVariablesInCollection(collectionId: string): Variable[] {
    return figma.variables
        .getLocalVariables()
        .filter((v: Variable) => v.variableCollectionId === collectionId);
}
