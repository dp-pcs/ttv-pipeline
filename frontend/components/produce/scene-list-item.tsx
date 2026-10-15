'use client';

import type { SceneDraft } from '@/lib/produce-store';

const pad = (n: number) => String(n).padStart(2, '0');
const fmtS = (d: number) => (d % 1 ? d.toFixed(1) : String(d)) + 's';

interface SceneListItemProps {
  scene: SceneDraft;
  idx: number;
  isActive: boolean;
  onClick: () => void;
}

export function SceneListItem({ scene, idx, isActive, onClick }: SceneListItemProps) {
  const modeLabel = scene.mode === 'continue_from_previous' ? '↳ continues' : 'independent';
  const modeColor = scene.mode === 'continue_from_previous' ? 'var(--c-accent)' : 'var(--c-dim)';

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        gap: '10px',
        padding: '10px 16px 10px 13px',
        borderLeft: `3px solid ${isActive ? 'var(--c-accent)' : 'transparent'}`,
        background: isActive ? '#161A1F' : 'transparent',
        cursor: 'pointer',
        borderBottom: '1px solid #1A1F25',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-mono, JetBrains Mono, monospace)',
          fontSize: '11px',
          color: 'var(--c-dim)',
          paddingTop: '2px',
          flexShrink: 0,
        }}
      >
        {pad(idx + 1)}
      </span>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <span
          style={{
            fontSize: '13px',
            lineHeight: '1.35',
            color: 'var(--c-text)',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {scene.summary || <span style={{ color: 'var(--c-dim)', fontStyle: 'italic' }}>New scene</span>}
        </span>
        <span
          style={{
            display: 'flex',
            gap: '8px',
            fontFamily: 'var(--font-mono, JetBrains Mono, monospace)',
            fontSize: '10.5px',
            color: 'var(--c-muted)',
          }}
        >
          <span>{fmtS(scene.dur)}</span>
          <span style={{ color: modeColor }}>{modeLabel}</span>
        </span>
      </div>
    </div>
  );
}
