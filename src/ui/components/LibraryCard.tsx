import React from 'react';

interface Props {
    id: string;
    name: string;
    description: string;
    iconSrc: string;
    selected: boolean;
    locked?: boolean;
    onToggle: () => void;
}

export default function LibraryCard({ name, description, iconSrc, selected, locked, onToggle }: Props) {
    return (
        <div
            className={`library-card ${selected ? 'selected' : ''} ${locked ? 'locked' : ''}`}
            onClick={locked ? undefined : onToggle}
            role="checkbox"
            aria-checked={selected}
            tabIndex={locked ? -1 : 0}
        >
            <div className={`checkbox-container ${selected ? 'checked' : ''} ${locked ? 'locked' : ''}`}>
                {selected && (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                )}
            </div>

            <img src={iconSrc} alt={name} className="library-icon-img" />

            <div className="library-info">
                <div className="library-name">{name}</div>
                <div className="library-desc">{description}</div>
            </div>
        </div>
    );
}
