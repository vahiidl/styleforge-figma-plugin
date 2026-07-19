// ─── Diff Engine ─────────────────────────────────────────────────────────────
// Compares an adapter's planned tokens against variables that already exist in
// a Figma collection, so the UI can show a review screen before overwriting.
// Pure functions — the figma-specific snapshotting lives in code.ts.

import { parseColorValue, colorsMatch, type FigmaColor } from './colorUtils';

export interface PlannedToken {
    name: string;
    /** Raw CSS values per mode; single-mode tokens use only `light`. */
    light?: string;
    dark?: string;
}

export interface ExistingVariableSnapshot {
    name: string;
    resolvedType: 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN';
    /** Values per mode name; colors as FigmaColor, others as primitives. */
    values: Record<string, FigmaColor | number | string | boolean | null>;
}

export interface TokenChange {
    name: string;
    mode: string;
    from: string;
    to: string;
}

export interface CollectionDiff {
    collectionName: string;
    /** Collection does not exist yet — everything is new. */
    isNew: boolean;
    added: string[];
    changed: TokenChange[];
    /** Variables in the collection that the import does not mention (left untouched). */
    unmanaged: string[];
}

function fmtColor(c: FigmaColor): string {
    const to255 = (v: number) => Math.round(v * 255);
    return c.a < 1
        ? `rgba(${to255(c.r)}, ${to255(c.g)}, ${to255(c.b)}, ${Math.round(c.a * 100) / 100})`
        : `#${[c.r, c.g, c.b].map(v => to255(v).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Diff planned theme tokens against an existing collection snapshot.
 * Only COLOR comparisons are value-aware; other types compare stringified values.
 */
export function diffCollection(
    collectionName: string,
    planned: PlannedToken[],
    existing: ExistingVariableSnapshot[] | null
): CollectionDiff {
    if (!existing) {
        return {
            collectionName,
            isNew: true,
            added: planned.map(p => p.name),
            changed: [],
            unmanaged: [],
        };
    }

    const existingByName = new Map(existing.map(e => [e.name, e]));
    const plannedNames = new Set(planned.map(p => p.name));
    const added: string[] = [];
    const changed: TokenChange[] = [];

    for (const p of planned) {
        const ex = existingByName.get(p.name);
        if (!ex) { added.push(p.name); continue; }

        for (const [mode, rawValue] of [['Light', p.light], ['Dark', p.dark]] as const) {
            if (rawValue === undefined) continue;
            const existingVal = ex.values[mode] ?? ex.values[Object.keys(ex.values)[0]];
            if (existingVal === null || existingVal === undefined) {
                changed.push({ name: p.name, mode, from: '(unset)', to: rawValue });
                continue;
            }
            const plannedColor = parseColorValue(rawValue);
            if (plannedColor && typeof existingVal === 'object' && 'r' in (existingVal as FigmaColor)) {
                if (!colorsMatch(existingVal as FigmaColor, plannedColor)) {
                    changed.push({ name: p.name, mode, from: fmtColor(existingVal as FigmaColor), to: rawValue });
                }
            } else if (typeof existingVal === 'number') {
                const plannedNum = parseFloat(rawValue);
                if (!isNaN(plannedNum) && Math.abs(existingVal - plannedNum) > 0.01) {
                    changed.push({ name: p.name, mode, from: String(existingVal), to: rawValue });
                }
            } else if (typeof existingVal === 'string' && existingVal !== rawValue) {
                changed.push({ name: p.name, mode, from: existingVal, to: rawValue });
            }
        }
    }

    const unmanaged = existing.filter(e => !plannedNames.has(e.name)).map(e => e.name);

    return { collectionName, isNew: false, added, changed, unmanaged };
}

/** Flatten theme tokens ({--name: value} maps) into PlannedTokens. */
export function planFromThemeTokens(
    light: Record<string, string>,
    dark: Record<string, string>
): PlannedToken[] {
    const names = new Set([...Object.keys(light), ...Object.keys(dark)]);
    return Array.from(names).map(key => ({
        name: key.replace(/^--/, ''),
        light: light[key],
        dark: dark[key],
    }));
}
