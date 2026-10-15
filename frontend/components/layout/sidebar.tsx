'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_GROUPS = [
  {
    label: 'Produce',
    items: [
      { n: '01', label: 'Compose',       href: '/' },
      { n: '02', label: 'Plan & approve', href: '/plan' },
      { n: '03', label: 'Storyboard',    href: '/storyboard' },
      { n: '04', label: 'Run',           href: '/run' },
      { n: '05', label: 'Result',        href: '/result' },
      { n: '06', label: 'Regenerate',    href: '/regenerate' },
    ],
  },
  {
    label: 'Library',
    items: [
      { n: '07', label: 'Jobs',      href: '/jobs' },
      { n: '08', label: 'Storage',   href: '/storage' },
      { n: '09', label: 'Transcribe', href: '/transcription' },
    ],
  },
  {
    label: 'System',
    items: [
      { n: '10', label: 'Health',   href: '/health' },
      { n: '11', label: 'Settings', href: '/settings' },
    ],
  },
];

const READYZ_COMPONENTS = ['api', 'redis', 'workers', 'gcs'] as const;

type ComponentHealth = Record<string, 'healthy' | 'unhealthy' | 'unknown'>;

function getBaseUrl(): string {
  if (typeof window === 'undefined') return 'http://localhost:8000';
  try {
    const raw = localStorage.getItem('visionweave_settings');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.api_base_url) return parsed.api_base_url;
    }
  } catch {}
  return 'http://localhost:8000';
}

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(href);
}

export function Sidebar() {
  const pathname = usePathname();
  const [health, setHealth] = useState<ComponentHealth>({});
  const [baseUrl, setBaseUrl] = useState('http://localhost:8000');

  useEffect(() => {
    const url = getBaseUrl();
    setBaseUrl(url);
    fetch(url + '/readyz')
      .then(r => r.json())
      .then(data => {
        const comps: ComponentHealth = {};
        for (const key of READYZ_COMPONENTS) {
          comps[key] = data?.components?.[key] === 'healthy' ? 'healthy' : 'unhealthy';
        }
        setHealth(comps);
      })
      .catch(() => {
        const comps: ComponentHealth = {};
        for (const key of READYZ_COMPONENTS) comps[key] = 'unknown';
        setHealth(comps);
      });
  }, []);

  function dotColor(key: string): string {
    const v = health[key];
    if (!v || v === 'unknown') return 'var(--c-dim)';
    return v === 'healthy' ? 'var(--c-ok)' : 'var(--c-fail)';
  }

  const displayUrl = baseUrl.replace(/^https?:\/\//, '');

  return (
    <aside
      style={{
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid var(--c-border)',
        background: 'var(--c-sidebar)',
        minHeight: 0,
      }}
    >
      {/* Logo / brand */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '16px 16px 18px',
          borderBottom: '1px solid var(--c-border)',
        }}
      >
        {/* Logo mark: two overlapping squares */}
        <div style={{ position: 'relative', width: '22px', height: '18px', flexShrink: 0 }}>
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: '14px',
              height: '12px',
              border: '1.5px solid var(--c-muted)',
              borderRadius: '2px',
            }}
          />
          <div
            style={{
              position: 'absolute',
              right: 0,
              bottom: 0,
              width: '14px',
              height: '12px',
              background: 'var(--c-accent)',
              borderRadius: '2px',
            }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span
            style={{
              fontWeight: 600,
              fontSize: '15px',
              letterSpacing: '-0.01em',
              color: 'var(--c-text)',
            }}
          >
            Continuity
          </span>
          <span
            style={{
              fontFamily: 'var(--font-mono, JetBrains Mono, monospace)',
              fontSize: '10px',
              color: 'var(--c-dim)',
              letterSpacing: '0.04em',
            }}
          >
            contract 1.0 · api v2
          </span>
        </div>
      </div>

      {/* Nav groups */}
      <nav
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
          padding: '16px 0',
          overflowY: 'auto',
          overflowX: 'hidden',
          flex: 1,
        }}
      >
        {NAV_GROUPS.map(group => (
          <div key={group.label} style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
            <div
              style={{
                fontFamily: 'var(--font-mono, JetBrains Mono, monospace)',
                fontSize: '10px',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--c-dim)',
                padding: '0 16px 6px',
              }}
            >
              {group.label}
            </div>
            {group.items.map(item => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '7px 16px 7px 13px',
                    borderLeft: `3px solid ${active ? 'var(--c-accent)' : 'transparent'}`,
                    background: active ? '#161A1F' : 'transparent',
                    color: active ? 'var(--c-text)' : '#B4BCC4',
                    cursor: 'pointer',
                    textDecoration: 'none',
                    transition: 'background 0.1s',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-mono, JetBrains Mono, monospace)',
                      fontSize: '10px',
                      color: 'var(--c-dim)',
                      width: '16px',
                      flexShrink: 0,
                    }}
                  >
                    {item.n}
                  </span>
                  <span style={{ flex: 1, fontSize: '13.5px', fontWeight: 500 }}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* /readyz footer */}
      <div
        style={{
          borderTop: '1px solid var(--c-border)',
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-mono, JetBrains Mono, monospace)',
            fontSize: '10px',
            color: 'var(--c-dim)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          /readyz
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '6px 10px',
          }}
        >
          {READYZ_COMPONENTS.map(key => (
            <div
              key={key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontFamily: 'var(--font-mono, JetBrains Mono, monospace)',
                fontSize: '11px',
                color: 'var(--c-muted)',
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: dotColor(key),
                  flexShrink: 0,
                }}
              />
              {key}
            </div>
          ))}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-mono, JetBrains Mono, monospace)',
            fontSize: '10.5px',
            color: 'var(--c-dim)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {displayUrl}
        </div>
      </div>
    </aside>
  );
}
