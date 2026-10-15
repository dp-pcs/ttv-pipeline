'use client';

import { usePathname } from 'next/navigation';

const STEPS = ['Request', 'Plan', 'Run', 'Result'] as const;

function getStageIndex(pathname: string): number {
  if (pathname === '/') return 0;
  if (pathname.startsWith('/plan')) return 1;
  if (pathname.startsWith('/run')) return 2;
  if (
    pathname.startsWith('/result') ||
    pathname.startsWith('/storyboard') ||
    pathname.startsWith('/regenerate')
  )
    return 3;
  return 0;
}

export function TopHeader() {
  const pathname = usePathname();
  const stage = getStageIndex(pathname);

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '0 16px',
        borderBottom: '1px solid var(--c-border)',
        background: 'var(--c-sidebar)',
        minWidth: 0,
      }}
    >
      {/* Breadcrumb */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontFamily: 'var(--font-mono, JetBrains Mono, monospace)',
          fontSize: '12px',
          color: 'var(--c-muted)',
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{ color: 'var(--c-text)' }}>harbor-short</span>
        <span style={{ color: 'var(--c-dim)' }}>/</span>
        <span style={{ color: 'var(--c-accent)' }}>r1</span>
      </div>

      {/* Step strip */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          justifyContent: 'center',
          minWidth: 0,
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          {STEPS.map((label, i) => {
            const isDone = i < stage;
            const isCurrent = i === stage;
            const color = isCurrent
              ? 'var(--c-accent)'
              : isDone
              ? 'var(--c-text)'
              : 'var(--c-dim)';
            const dot = isDone
              ? 'var(--c-ok)'
              : isCurrent
              ? 'var(--c-accent)'
              : 'transparent';
            const dotBorder = isCurrent
              ? 'var(--c-accent)'
              : isDone
              ? 'var(--c-ok)'
              : 'var(--c-dim)';
            const lineColor = i === STEPS.length - 1 ? 'transparent' : 'var(--c-border2)';

            return (
              <div key={label} style={{ display: 'flex', alignItems: 'center' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 6px',
                    fontSize: '12px',
                    fontWeight: 500,
                    color,
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span
                    style={{
                      width: '7px',
                      height: '7px',
                      borderRadius: '1px',
                      background: dot,
                      border: `1px solid ${dotBorder}`,
                      flexShrink: 0,
                    }}
                  />
                  {label}
                </div>
                {i < STEPS.length - 1 && (
                  <div style={{ width: '8px', height: '1px', background: lineColor }} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Status badges */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontFamily: 'var(--font-mono, JetBrains Mono, monospace)',
          fontSize: '11px',
          whiteSpace: 'nowrap',
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '3px 8px',
            border: '1px solid var(--c-border2)',
            borderRadius: '3px',
            color: 'var(--c-muted)',
          }}
        >
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: 'var(--c-ok)',
              flexShrink: 0,
            }}
          />
          readyz ok
        </span>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '3px 8px',
            border: '1px solid var(--c-border2)',
            borderRadius: '3px',
            color: 'var(--c-muted)',
          }}
        >
          AUTH{' '}
          <span style={{ color: 'var(--c-ok)' }}>set</span>
        </span>
      </div>
    </header>
  );
}
