// ─── Variable Exporter ───────────────────────────────────────────────────────
// Serializes local Figma variable collections back to DTCG JSON and CSS custom
// properties — the round-trip path (tweak in Figma → ship to code).

import type { FigmaColor } from './colorUtils';

export interface ExportedVariable {
    name: string;
    type: 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN';
    values: Record<string, FigmaColor | number | string | boolean | null>;
}

export interface ExportedCollection {
    name: string;
    modes: string[];
    variables: ExportedVariable[];
}

function colorToHex(c: FigmaColor): string {
    const to255 = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0');
    const base = `#${to255(c.r)}${to255(c.g)}${to255(c.b)}`;
    return c.a < 1 ? base + to255(c.a) : base;
}

function dtcgType(t: ExportedVariable['type']): string {
    switch (t) {
        case 'COLOR': return 'color';
        case 'FLOAT': return 'number';
        default: return 'string';
    }
}

function dtcgValue(type: ExportedVariable['type'], v: FigmaColor | number | string | boolean | null): unknown {
    if (v === null) return null;
    if (type === 'COLOR' && typeof v === 'object') return colorToHex(v as FigmaColor);
    return v;
}

/**
 * Serialize collections to a DTCG document. Multi-mode collections nest under
 * `$extensions.styleforge.modes`; the first mode is the canonical `$value`.
 */
export function toDtcg(collections: ExportedCollection[]): string {
    const doc: Record<string, unknown> = {
        $description: 'Exported from Figma by StyleForge',
    };

    for (const col of collections) {
        const group: Record<string, unknown> = {};
        for (const v of col.variables) {
            // nest by path segments
            const segs = v.name.split('/');
            let node = group;
            for (let i = 0; i < segs.length - 1; i++) {
                node[segs[i]] = node[segs[i]] || {};
                node = node[segs[i]] as Record<string, unknown>;
            }
            const first = col.modes[0];
            const token: Record<string, unknown> = {
                $type: dtcgType(v.type),
                $value: dtcgValue(v.type, v.values[first]),
            };
            if (col.modes.length > 1) {
                const modes: Record<string, unknown> = {};
                for (const m of col.modes) modes[m] = dtcgValue(v.type, v.values[m]);
                token.$extensions = { styleforge: { modes } };
            }
            node[segs[segs.length - 1]] = token;
        }
        doc[col.name] = group;
    }

    return JSON.stringify(doc, null, 2);
}

/**
 * Serialize collections to CSS custom properties.
 * First mode → `:root`, second mode (if any) → `.dark`.
 */
export function toCss(collections: ExportedCollection[]): string {
    const lines: string[] = [`/* Exported from Figma by StyleForge */`];

    for (const col of collections) {
        lines.push(``, `/* ─── ${col.name} ─── */`);
        const varName = (n: string) => '--' + n.replace(/\//g, '-').replace(/[^\w-]/g, '-').toLowerCase();
        const emit = (mode: string, selector: string) => {
            const rows: string[] = [];
            for (const v of col.variables) {
                const val = v.values[mode];
                if (val === null || val === undefined) continue;
                let css: string;
                if (v.type === 'COLOR' && typeof val === 'object') css = colorToHex(val as FigmaColor);
                else if (v.type === 'FLOAT') css = `${val}px`;
                else css = String(val);
                rows.push(`  ${varName(v.name)}: ${css};`);
            }
            if (rows.length) lines.push(`${selector} {`, ...rows, `}`);
        };
        emit(col.modes[0], ':root');
        if (col.modes.length > 1) emit(col.modes[1], '.dark');
    }

    return lines.join('\n');
}
