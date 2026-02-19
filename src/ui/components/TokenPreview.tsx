import React, { useState } from 'react';
import type { PreviewNode } from '../../adapters/types';

interface Props {
    nodes: PreviewNode[];
}

export default function TokenPreview({ nodes }: Props) {
    return (
        <div className="preview-tree">
            {nodes.map((node, i) => (
                <PreviewNodeItem key={i} node={node} />
            ))}
        </div>
    );
}

function PreviewNodeItem({ node }: { node: PreviewNode }) {
    const [open, setOpen] = useState(false);
    const hasChildren = node.children && node.children.length > 0;

    return (
        <div className="preview-node">
            <div
                className="preview-node-header"
                onClick={() => hasChildren && setOpen(!open)}
            >
                {hasChildren && (
                    <span className={`preview-chevron ${open ? 'open' : ''}`}>▶</span>
                )}
                {!hasChildren && <span style={{ width: 12 }} />}
                <span className="preview-label">{node.label}</span>
                <span className="preview-count">{node.count}</span>
            </div>
            {open && hasChildren && (
                <div className="preview-children">
                    {node.children!.map((child, i) => (
                        <PreviewNodeItem key={i} node={child} />
                    ))}
                </div>
            )}
        </div>
    );
}
