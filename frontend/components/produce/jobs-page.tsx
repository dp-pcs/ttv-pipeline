'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useProduceStore } from '@/lib/produce-store';

interface V1Job {
  id: string;
  status: string;
  progress: number;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  gcs_uri: string | null;
  error: string | null;
  title: string | null;
  prompt: string | null;
}

const STATUS_FILTERS = ['all', 'active', 'finished', 'failed', 'canceled'] as const;
type FilterKey = typeof STATUS_FILTERS[number];

const K = {
  ok: 'var(--c-ok)',
  run: 'var(--c-run)',
  fail: 'var(--c-fail)',
  dim: 'var(--c-dim)',
  amber: 'var(--c-accent)',
};

function statusColor(status: string): string {
  if (['finished', 'succeeded'].includes(status)) return K.ok;
  if (['progress', 'started', 'queued', 'running'].includes(status)) return K.run;
  if (status === 'failed') return K.fail;
  return K.dim;
}

function isActive(status: string): boolean {
  return ['progress', 'started', 'queued', 'running'].includes(status);
}

function pad(n: number) { return String(n).padStart(2, '0'); }

function fmtRuntime(startedAt: string | null, finishedAt: string | null): string {
  if (!startedAt) return '—';
  const start = new Date(startedAt).getTime();
  const end = finishedAt ? new Date(finishedAt).getTime() : Date.now();
  const secs = Math.floor((end - start) / 1000);
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m ${pad(secs % 60)}s`;
}

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}

export function JobsPage() {
  const router = useRouter();
  const baseUrl = useProduceStore(s => s.baseUrl);
  const activeJob = useProduceStore(s => s.activeJob);

  const [jobs, setJobs] = useState<V1Job[]>([]);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchJobs() {
    try {
      const r = await fetch(`${baseUrl}/v1/jobs?limit=50`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setJobs(Array.isArray(data) ? data : []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load jobs');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchJobs();
    const iv = setInterval(fetchJobs, 10000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseUrl]);

  // Merge live activeJob at top if not already in v1 list
  const allRows: (V1Job & { isLive?: boolean })[] = [];
  if (activeJob) {
    const inList = jobs.some(j => j.id === activeJob.id);
    if (!inList) {
      allRows.push({
        id: activeJob.id,
        status: activeJob.status,
        progress: activeJob.progress ?? 0,
        created_at: activeJob.created_at,
        started_at: activeJob.started_at ?? null,
        finished_at: activeJob.finished_at ?? null,
        gcs_uri: activeJob.result_uri ?? null,
        error: null,
        title: null,
        prompt: null,
        isLive: true,
      });
    }
  }
  allRows.push(...jobs.map(j => ({ ...j, isLive: activeJob?.id === j.id })));

  const filtered = allRows.filter(j => {
    if (filter === 'all') return true;
    if (filter === 'active') return isActive(j.status);
    return j.status === filter;
  });

  const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono, JetBrains Mono, monospace)' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', padding: '20px 28px 16px', borderBottom: '1px solid var(--c-border)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ ...MONO, fontSize: 11, letterSpacing: '.06em', color: 'var(--c-muted)' }}>07 · GET /v1/jobs · /v2/jobs/{'{id}'}</div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--c-text)' }}>Jobs</h1>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {STATUS_FILTERS.map(f => (
            <div
              key={f}
              onClick={() => setFilter(f)}
              style={{
                ...MONO, fontSize: 11, padding: '5px 10px', borderRadius: 3, cursor: 'pointer',
                border: `1px solid ${f === filter ? 'var(--c-accent)' : 'var(--c-border2)'}`,
                color: f === filter ? 'var(--c-accent)' : 'var(--c-dim)',
              }}
            >
              {f}
            </div>
          ))}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div style={{ padding: '16px 28px', color: 'var(--c-fail)', ...MONO, fontSize: 13 }}>
          Failed to load jobs: {error}
        </div>
      )}

      {/* Loading */}
      {loading && !error && (
        <div style={{ padding: '40px 28px', color: 'var(--c-dim)', ...MONO, fontSize: 13 }}>Loading…</div>
      )}

      {/* Table */}
      {!loading && (
        <div style={{ overflowX: 'auto' }}>
          {/* Header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '120px minmax(220px,1fr) 90px 100px 120px 160px 90px 70px',
            minWidth: 1000, padding: '10px 28px 8px',
            ...MONO, fontSize: 10, letterSpacing: '.05em', color: 'var(--c-dim)',
            borderBottom: '1px solid var(--c-border)',
          }}>
            <span>ID</span><span>TITLE / PROMPT</span><span>KIND</span><span>STATUS</span>
            <span>PROGRESS</span><span>CREATED</span><span style={{ textAlign: 'right' }}>RUNTIME</span><span style={{ textAlign: 'right' }}>USD</span>
          </div>

          {filtered.length === 0 && (
            <div style={{ padding: '40px 28px', color: 'var(--c-dim)', ...MONO, fontSize: 13 }}>No jobs match this filter.</div>
          )}

          {filtered.map(j => {
            const sColor = statusColor(j.status);
            const pct = Math.max(0, Math.min(100, j.progress ?? 0));
            return (
              <div
                key={j.id}
                onClick={() => {
                  if (activeJob && j.id === activeJob.id) router.push('/run');
                  else if (['finished', 'succeeded'].includes(j.status) && activeJob?.result_id) router.push('/result');
                }}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '120px minmax(220px,1fr) 90px 100px 120px 160px 90px 70px',
                  minWidth: 1000, padding: '10px 28px',
                  borderBottom: '1px solid var(--c-border)',
                  cursor: 'pointer', alignItems: 'center',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#13171B')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {/* ID */}
                <span style={{ ...MONO, fontSize: 11.5, color: 'var(--c-accent)' }}>
                  {j.id.slice(0, 8)}…
                </span>

                {/* Title / Prompt */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, paddingRight: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--c-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {j.title || (j.prompt ? j.prompt.slice(0, 60) + (j.prompt.length > 60 ? '…' : '') : j.id.slice(0, 12) + '…')}
                    </span>
                    {j.isLive && (
                      <span style={{ ...MONO, fontSize: 9, padding: '2px 5px', background: 'rgba(232,162,58,0.15)', border: '1px solid var(--c-accent)', borderRadius: 2, color: 'var(--c-accent)', flexShrink: 0 }}>LIVE</span>
                    )}
                  </div>
                  {j.prompt && j.title && (
                    <span style={{ ...MONO, fontSize: 11, color: 'var(--c-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {j.prompt.slice(0, 60)}{j.prompt.length > 60 ? '…' : ''}
                    </span>
                  )}
                </div>

                {/* Kind */}
                <span style={{ ...MONO, fontSize: 11, color: 'var(--c-muted)' }}>
                  {j.gcs_uri?.includes('keyframe') ? 'keyframes' : 'video'}
                </span>

                {/* Status */}
                <span style={{ ...MONO, fontSize: 11, color: sColor }}>
                  {j.status}
                </span>

                {/* Progress */}
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, paddingRight: 12 }}>
                  <span style={{ flex: 1, height: 3, background: '#1A1F25', borderRadius: 2, overflow: 'hidden' }}>
                    <span style={{ display: 'block', height: '100%', width: pct + '%', background: sColor }} />
                  </span>
                  <span style={{ ...MONO, fontSize: 10.5, color: 'var(--c-muted)', width: 34 }}>{pct}%</span>
                </span>

                {/* Created */}
                <span style={{ ...MONO, fontSize: 11, color: 'var(--c-muted)' }}>{fmtDate(j.created_at)}</span>

                {/* Runtime */}
                <span style={{ ...MONO, fontSize: 11, textAlign: 'right' }}>{fmtRuntime(j.started_at, j.finished_at)}</span>

                {/* USD */}
                <span style={{ ...MONO, fontSize: 11, textAlign: 'right', color: 'var(--c-muted)' }}>—</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
