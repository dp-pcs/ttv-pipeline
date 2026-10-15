'use client';

import { useEffect, useState } from 'react';
import { useProduceStore } from '@/lib/produce-store';

interface ReadyzResp {
  status: string;
  timestamp: string;
  version: string;
  components: Record<string, string>;
}

interface MetricsResp {
  active_jobs: number;
  queued_jobs: number;
  total_jobs_processed: number;
  average_processing_time: number;
  uptime_seconds: number;
  total_requests: number;
  average_request_latency: number;
  requests_per_second: number;
  jobs_per_hour: number;
  queue_depth: number;
  status_code_distribution: Record<string, number>;
}

interface SystemMetricsResp {
  system_health: {
    components: Record<string, { healthy: boolean; last_check: string; error?: string }>;
    performance: {
      uptime_seconds: number;
      requests_per_second: number;
      jobs_per_hour: number;
      average_request_latency: number;
      average_job_duration: number;
    };
    capacity: { queue_depth: number; active_jobs: number };
  };
  queue_metrics: { total_depth: number; queued: number; active: number; finished: number; failed: number };
  histogram_data: {
    job_duration_distribution: Record<string, number>;
    request_latency_distribution: Record<string, number>;
  };
  latency_metrics: {
    average_request_latency: number;
    average_job_duration: number;
    p95_request_latency: number;
    p99_request_latency: number;
  };
  error_metrics: {
    status_code_distribution: Record<string, number>;
    error_rate: number;
    failed_jobs: number;
  };
}

function pad(n: number) { return String(n).padStart(2, '0'); }

function fmtUptime(secs: number): string {
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  return `${d}d ${pad(h)}:${pad(m)}:${pad(s)}`;
}

function fmtLatency(s: number): string {
  return `${Math.round(s * 1000)} ms`;
}

function fmtAvgJobDur(secs: number): string {
  if (!secs) return '—';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}m ${pad(s)}s`;
}

function codeColor(code: string): string {
  if (code.startsWith('2')) return 'var(--c-ok)';
  if (code.startsWith('4')) return 'var(--c-warn)';
  if (code.startsWith('5')) return 'var(--c-fail)';
  return 'var(--c-muted)';
}

const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono, JetBrains Mono, monospace)' };
const SECTION_HDR: React.CSSProperties = { ...MONO, fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--c-muted)' };

export function HealthPage() {
  const baseUrl = useProduceStore(s => s.baseUrl);
  const [readyz, setReadyz] = useState<ReadyzResp | null>(null);
  const [metrics, setMetrics] = useState<MetricsResp | null>(null);
  const [system, setSystem] = useState<SystemMetricsResp | null>(null);

  async function fetchAll() {
    try {
      const [rz, m, sy] = await Promise.allSettled([
        fetch(`${baseUrl}/readyz`).then(r => r.json()),
        fetch(`${baseUrl}/metrics`).then(r => r.json()),
        fetch(`${baseUrl}/metrics/system`).then(r => r.json()),
      ]);
      if (rz.status === 'fulfilled') setReadyz(rz.value);
      if (m.status === 'fulfilled') setMetrics(m.value);
      if (sy.status === 'fulfilled') setSystem(sy.value);
    } catch {}
  }

  useEffect(() => {
    fetchAll();
    const iv = setInterval(fetchAll, 30000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseUrl]);

  const uptime = system?.system_health?.performance?.uptime_seconds ?? metrics?.uptime_seconds ?? 0;
  const version = readyz?.version ?? '—';

  const components = readyz?.components ?? {};
  const COMP_KEYS = ['api', 'redis', 'workers', 'gcs'];

  // Stat tiles
  const tiles = [
    { k: 'active_jobs', v: String(metrics?.active_jobs ?? '—') },
    { k: 'queued_jobs', v: String(metrics?.queued_jobs ?? '—') },
    { k: 'total_jobs_processed', v: String(metrics?.total_jobs_processed ?? '—') },
    { k: 'jobs_per_hour', v: metrics ? metrics.jobs_per_hour.toFixed(2) : '—' },
    { k: 'avg_processing_time', v: metrics ? fmtAvgJobDur(metrics.average_processing_time) : '—' },
    { k: 'requests_per_second', v: metrics ? metrics.requests_per_second.toFixed(2) : '—' },
    { k: 'avg_request_latency', v: metrics ? fmtLatency(metrics.average_request_latency) : '—' },
    { k: 'queue_depth', v: String(metrics?.queue_depth ?? '—') },
  ];

  // Histogram
  const durHisto = system?.histogram_data?.job_duration_distribution ?? {};
  const durEntries = Object.entries(durHisto);
  const durMax = Math.max(1, ...durEntries.map(([, v]) => v));

  // Status codes
  const codeDist = system?.error_metrics?.status_code_distribution ?? metrics?.status_code_distribution ?? {};
  const codeEntries = Object.entries(codeDist).sort(([a], [b]) => a.localeCompare(b));
  const codeTotal = codeEntries.reduce((s, [, n]) => s + n, 0) || 1;

  // Latency rows
  const lat = system?.latency_metrics;
  const latRows = lat ? [
    { k: 'avg', v: fmtLatency(lat.average_request_latency), w: lat.average_request_latency / (lat.p99_request_latency || 1) },
    { k: 'p95', v: fmtLatency(lat.p95_request_latency), w: lat.p95_request_latency / (lat.p99_request_latency || 1) },
    { k: 'p99', v: fmtLatency(lat.p99_request_latency), w: 1 },
  ] : [];

  // Queue metrics
  const qm = system?.queue_metrics;

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', padding: '20px 28px 16px', borderBottom: '1px solid var(--c-border)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ ...MONO, fontSize: 11, letterSpacing: '.06em', color: 'var(--c-muted)' }}>10 · /readyz · /metrics · /metrics/system</div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--c-text)' }}>Health</h1>
        </div>
        <span style={{ ...MONO, fontSize: 11, color: 'var(--c-muted)' }}>uptime {fmtUptime(uptime)} · api {version}</span>
      </div>

      {/* Component status grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', borderBottom: '1px solid var(--c-border)' }}>
        {COMP_KEYS.map(k => {
          const healthy = components[k] === 'healthy';
          return (
            <div key={k} style={{ padding: '16px 28px', borderRight: '1px solid var(--c-border)', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ ...MONO, fontSize: 11, color: 'var(--c-muted)' }}>{k}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 600, color: healthy ? 'var(--c-ok)' : 'var(--c-fail)' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: healthy ? 'var(--c-ok)' : 'var(--c-fail)', flexShrink: 0 }} />
                {healthy ? 'healthy' : 'unhealthy'}
              </span>
            </div>
          );
        })}
      </div>

      {/* Stat tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', borderBottom: '1px solid var(--c-border)' }}>
        {tiles.map(t => (
          <div key={t.k} style={{ padding: '16px 28px', borderRight: '1px solid #1A1F25', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ ...MONO, fontSize: 10.5, color: 'var(--c-muted)' }}>{t.k}</span>
            <span style={{ ...MONO, fontSize: 22, letterSpacing: '-0.02em', color: 'var(--c-text)' }}>{t.v}</span>
          </div>
        ))}
      </div>

      {/* Visualizations */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))' }}>
        {/* Job duration histogram */}
        <div style={{ padding: '20px 28px', borderRight: '1px solid var(--c-border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={SECTION_HDR}>Job Duration Histogram (s)</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120 }}>
            {durEntries.length === 0 && <span style={{ ...MONO, fontSize: 12, color: 'var(--c-dim)' }}>No data</span>}
            {durEntries.map(([label, count]) => (
              <div key={label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
                <div style={{ width: '100%', height: `${Math.max(2, (count / durMax) * 100)}%`, background: '#3A434E', borderRadius: '2px 2px 0 0' }} />
                <span style={{ ...MONO, fontSize: 9.5, color: 'var(--c-dim)', textAlign: 'center' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Status code distribution */}
        <div style={{ padding: '20px 28px', borderRight: '1px solid var(--c-border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={SECTION_HDR}>Status Code Distribution</div>
          {codeEntries.length > 0 ? (
            <>
              <div style={{ display: 'flex', height: 10, borderRadius: 2, overflow: 'hidden', gap: 2 }}>
                {codeEntries.map(([code, n]) => (
                  <div key={code} style={{ flex: n, background: codeColor(code) }} />
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {codeEntries.map(([code, n]) => (
                  <div key={code} style={{ display: 'flex', justifyContent: 'space-between', ...MONO, fontSize: 11.5 }}>
                    <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ width: 8, height: 8, background: codeColor(code), borderRadius: 1, flexShrink: 0 }} />
                      {code}
                    </span>
                    <span style={{ color: 'var(--c-muted)' }}>{n}</span>
                  </div>
                ))}
              </div>
            </>
          ) : <span style={{ ...MONO, fontSize: 12, color: 'var(--c-dim)' }}>No data</span>}
        </div>

        {/* Latency + Queue */}
        <div style={{ padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={SECTION_HDR}>Latency Metrics</div>
          {latRows.length === 0 && <span style={{ ...MONO, fontSize: 12, color: 'var(--c-dim)' }}>No data</span>}
          {latRows.map(row => (
            <div key={row.k} style={{ display: 'grid', gridTemplateColumns: '50px minmax(0,1fr) 70px', gap: 10, alignItems: 'center', ...MONO, fontSize: 11.5 }}>
              <span style={{ color: 'var(--c-muted)' }}>{row.k}</span>
              <span style={{ height: 4, background: '#1A1F25', borderRadius: 2, overflow: 'hidden' }}>
                <span style={{ display: 'block', height: '100%', width: `${Math.round(row.w * 100)}%`, background: row.w > 0.8 ? 'var(--c-warn)' : 'var(--c-dim)' }} />
              </span>
              <span style={{ textAlign: 'right' }}>{row.v}</span>
            </div>
          ))}

          {qm && (
            <>
              <div style={{ ...SECTION_HDR, marginTop: 10 }}>Queue Metrics</div>
              {[
                ['default.queued', qm.queued],
                ['default.active', qm.active],
                ['default.finished', qm.finished],
                ['default.failed', qm.failed],
              ].map(([k, v]) => (
                <div key={String(k)} style={{ display: 'flex', justifyContent: 'space-between', ...MONO, fontSize: 11.5 }}>
                  <span style={{ color: 'var(--c-muted)' }}>{k}</span>
                  <span>{v}</span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
