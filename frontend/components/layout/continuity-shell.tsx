'use client';

import { Sidebar } from './sidebar';
import { TopHeader } from './top-header';

export function ContinuityShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '216px minmax(0,1fr)',
        height: '100vh',
        background: 'var(--c-bg)',
        color: 'var(--c-text)',
        fontFamily: 'var(--font-sans, Hanken Grotesk, Helvetica Neue, Arial, sans-serif)',
        fontSize: '14px',
        lineHeight: '1.45',
      }}
    >
      <Sidebar />
      <main
        style={{
          display: 'grid',
          gridTemplateRows: '52px minmax(0,1fr)',
          minWidth: 0,
          minHeight: 0,
        }}
      >
        <TopHeader />
        <div style={{ overflow: 'auto', minHeight: 0, position: 'relative' }}>
          {children}
        </div>
      </main>
    </div>
  );
}
