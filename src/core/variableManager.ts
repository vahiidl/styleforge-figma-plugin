// ─── Figma Variable Manager ──────────────────────────────────────────────────
// Handles creation and management of Figma Variable Collections, Variables,
// and alias resolution between Primitives and Theme collections.

import type { FigmaColor } from './colorUtils';
import { colorsMatch } from './colorUtils';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CollectionInfo {
    collection: VariableCollection;
    modeIds: Record<string, string>; // e.g. { "Light": "mode-id-1", "Dark": "mode-id-2" }
    /** True when the plan's mode limit prevented creating all requested modes. */
    modeLimited?: boolean;
}

export interface VariableEntry {
    variable: Variable;
    collection: VariableCollection;
}

// ─── Collection Management ───────────────────────────────────────────────────

/**
 * Find an existing collection by name or create a new one.
 */
export async function findOrCreateCollection(name: string): Promise<CollectionInfo> {
    const collections = await figma.variables.getLocalVariableCollectionsAsync();
    const existing = collections.find((c: VariableCollection) => c.name === name);

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

    // Add additional modes. Free/Starter files allow only ONE mode per
    // collection — addMode throws "Limited to 1 modes only". In that case we
    // degrade gracefully: the import continues with the first mode only.
    let modeLimited = false;
    for (let i = 1; i < modeNames.length; i++) {
        const existingMode = collection.modes.find((m: { name: string; modeId: string }) => m.name === modeNames[i]);
        if (existingMode) {
            modeIds[modeNames[i]] = existingMode.modeId;
        } else {
            try {
                const newModeId = collection.addMode(modeNames[i]);
                modeIds[modeNames[i]] = newModeId;
            } catch (e) {
                modeLimited = true;
            }
        }
    }

    return { collection, modeIds, modeLimited };
}

// ─── Variable Creation ───────────────────────────────────────────────────────

/**
 * Find an existing variable by name in a collection, or create a new one.
 */
export async function findOrCreateVariable(
    collection: VariableCollection,
    name: string,
    type: VariableResolvedDataType
): Promise<Variable> {
    const allVars = await figma.variables.getLocalVariablesAsync(type);
    const existing = allVars.find((v: Variable) => v.name === name && v.variableCollectionId === collection.id);

    if (existing) return existing;

    return figma.variables.createVariable(name, collection, type);
}

/**
 * Create a color variable and set its value for a given mode.
 */
export async function setColorVariable(
    collection: VariableCollection,
    modeId: string,
    name: string,
    color: FigmaColor
): Promise<Variable> {
    const variable = await findOrCreateVariable(collection, name, 'COLOR');
    variable.setValueForMode(modeId, color);
    return variable;
}

/**
 * Create a float variable and set its value for a given mode.
 */
export async function setFloatVariable(
    collection: VariableCollection,
    modeId: string,
    name: string,
    value: number
): Promise<Variable> {
    const variable = await findOrCreateVariable(collection, name, 'FLOAT');
    variable.setValueForMode(modeId, value);
    return variable;
}

/**
 * Create a string variable and set its value for a given mode.
 */
export async function setStringVariable(
    collection: VariableCollection,
    modeId: string,
    name: string,
    value: string
): Promise<Variable> {
    const variable = await findOrCreateVariable(collection, name, 'STRING');
    variable.setValueForMode(modeId, value);
    return variable;
}

/**
 * Attach WEB code syntax (e.g. `var(--primary)`) so Dev Mode shows the CSS token.
 * Safe no-op on API versions without codeSyntax support.
 */
export function setCodeSyntax(variable: Variable, css: string): void {
    try {
        variable.setVariableCodeSyntax('WEB', css);
    } catch (e) {
        // Older typings/plugin API — ignore.
    }
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
export async function getVariablesInCollection(collectionId: string): Promise<Variable[]> {
    const allVars = await figma.variables.getLocalVariablesAsync();
    return allVars.filter((v: Variable) => v.variableCollectionId === collectionId);
}
