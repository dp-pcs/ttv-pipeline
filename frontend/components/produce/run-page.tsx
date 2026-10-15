'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useProduceStore } from '@/lib/produce-store';
import { getJob, getJobResult, cancelJob, ApiV2Error } from '@/lib/api-v2';
import { useToast } from '@/hooks/use-toast';

const K = {
  ok: '#4FBF8B', run: '#5BA8E0', fail: '#E2685C', warn: '#CDB65A', amber: '#E8A23A',
  text: '#E4E8EB', mute: '#8C96A0', dim: '#5E6872',
};

const TERMINAL = new Set(['finished', 'failed', 'canceled', 'done']);

function statusColor(s: string): string {
  if (s === 'running' || s === 'started' || s === 'progress') return K.run;
  if (s === 'finished' || s === 'succeeded' || s === 'done') return K.ok;
  if (s === 'failed') return K.fail;
  if (s === 'canceled') return K.warn;
  return K.dim;
}

function elapsed(startedAt: string | null | undefined): string {
  if (!startedAt) return '—';
  const ms = Date.now() - new Date(startedAt).getTime();
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function pad(n: number) { return String(n).padStart(2, '0'); }

export function RunPage() {
  const router = useRouter();
  const { toast } = useToast();

  const activeJob = useProduceStore(s => s.activeJob);
  const updateActiveJob = useProduceStore(s => s.updateActiveJob);
  const setActiveJob = useProduceStore(s => s.setActiveJob);
  const executionMode = useProduceStore(s => s.executionMode);
  const plan = useProduceStore(s => s.plan);
  const scenes = useProduceStore(s => s.scenes);
  const setKfResult = useProduceStore(s => s.setKfResult);
  const setVideoResult = useProduceStore(s => s.setVideoResult);
  const setRegenSel = useProduceStore(s => s.setRegenSel);

  const pollingRef = useRef(false);

  useEffect(() => {
    if (!activeJob || TERMINAL.has(activeJob.status)) return;

    pollingRef.current = true;
    const iv = setInterval(async () => {
      if (!pollingRef.current) return;
      try {
        const job = await getJob(activeJob.id);
        updateActiveJob(job);
        if (TERMINAL.has(job.status)) {
          clearInterval(iv);
          pollingRef.current = false;
          if (job.result_id) {
            try {
              const result = await getJobResult(job.id);
              if (executionMode === 'keyframes') {
                setKfResult(result);
              } else {
                setVideoResult(result);
                const sel: Record<string, boolean> = {};
                result.scenes.forEach(sc => { if (sc.status !== 'succeeded') sel[sc.scene_id] = true; });
                setRegenSel(sel);
              }
            } catch (err) {
              console.error('Failed to fetch result:', err);
            }
          }
        }
      } catch (err) {
        console.error('Poll error:', err);
      }
    }, 2000);

    return () => { clearInterval(iv); pollingRef.current = false; };
  }, [activeJob?.id, activeJob?.status]);

  const handleCancel = async () => {
    if (!activeJob) return;
    try {
      const job = await cancelJob(activeJob.id);
      setActiveJob(job);
    } catch (err) {
      const msg = err instanceof ApiV2Error ? err.message : 'Failed to cancel job';
      toast({ variant: 'destructive', title: 'Cancel failed', description: msg });
    }
  };

  if (!activeJob) {
    return (
      <div style={{ margin: '60px auto', maxWidth: 420, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', padding: '0 20px' }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--c-text)' }}>No active job</div>
        <div style={{ color: 'var(--c-muted)', fontSize: 13.5 }}>Approve a plan to queue a job. Workers run each scene's shots in order and keep every attempt.</div>
        <Link href="/plan" style={{ background: 'transparent', border: '1px solid var(--c-accent)', color: 'var(--c-accent)', padding: '8px 12px', borderRadius: 4, fontSize: 13, textDecoration: 'none' }}>
          Go to Plan →
        </Link>
      </div>
    );
  }

  const isRunning = !TERMINAL.has(activeJob.status);
  const isDone = TERMINAL.has(activeJob.status);
  const progress = activeJob.progress ?? 0;

  // Build per-scene status from plan + current job position
  const planScenes = plan ? [...plan.scenes].sort((a, b) => a.order - b.order) : [];
  const currentIdx = planScenes.findIndex(ps => ps.scene_id === activeJob.current_scene_id);

  const sceneRows = planScenes.map((ps, i) => {
    const draft = scenes.find(s => s.id === ps.scene_id);
    const summary = draft?.summary || ps.scene_id;
    let sceneStatus: 'done' | 'running' | 'pending';
    if (isDone) {
      sceneStatus = 'done';
    } else if (ps.scene_id === activeJob.current_scene_id) {
      sceneStatus = 'running';
    } else if (currentIdx >= 0 && i < currentIdx) {
      sceneStatus = 'done';
    } else {
      sceneStatus = 'pending';
    }
    const color = sceneStatus === 'done' ? K.ok : sceneStatus === 'running' ? K.run : K.dim;
    return { ps, summary, sceneStatus, color };
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', padding: '20px 28px 16px', borderBottom: '1px solid var(--c-border)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.06em', color: 'var(--c-muted)' }}>
            04 · GET /v2/jobs/{'{id}'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--c-text)' }}>Run</h1>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--c-accent)' }}>{activeJob.id}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 8px', border: `1px solid ${statusColor(activeJob.status)}55`, borderRadius: 3, fontFamily: 'var(--font-mono)', fontSize: 11, color: statusColor(activeJob.status) }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor(activeJob.status) }} />
              {activeJob.status}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--c-muted)' }}>
              execution_mode={executionMode} · elapsed {elapsed(activeJob.started_at)}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {isRunning && (
            <button onClick={handleCancel} style={{ background: 'transparent', border: '1px solid var(--c-fail)', color: 'var(--c-fail)', padding: '8px 12px', borderRadius: 4, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
              Cancel job
            </button>
          )}
          {isDone && (
            <button
              onClick={() => router.push(executionMode === 'keyframes' ? '/storyboard' : '/result')}
              style={{ background: 'var(--c-accent)', border: 'none', color: '#17110A', padding: '9px 14px', borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              {executionMode === 'keyframes' ? 'Review storyboard' : 'Open result'}
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ padding: '14px 28px', borderBottom: '1px solid var(--c-border)', display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ flex: 1, height: 6, background: 'var(--c-border2)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: 'var(--c-accent)', transition: 'width 0.5s' }} />
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, width: 44, textAlign: 'right' }}>{progress}%</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--c-muted)' }}>
          {planScenes.length} scene{planScenes.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Scene list */}
      <div style={{ padding: '12px 0 40px', minWidth: 0 }}>
        {/* Column headers */}
        <div style={{ display: 'grid', gridTemplateColumns: '64px minmax(0,1fr) 80px', fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '.05em', color: 'var(--c-dim)', padding: '0 28px 8px' }}>
          <span>SCENE</span><span>SUMMARY</span><span style={{ textAlign: 'right' }}>STATUS</span>
        </div>

        {sceneRows.map(({ ps, summary, sceneStatus, color }) => (
          <div key={ps.scene_id} style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '8px 28px', borderTop: '1px solid #1A1F25', background: sceneStatus === 'running' ? 'rgba(91,168,224,0.04)' : 'transparent' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '64px minmax(0,1fr) 80px', alignItems: 'center', fontFamily: 'var(--font-mono)', fontSize: 11.5 }}>
              <span style={{ color: 'var(--c-accent)' }}>{ps.scene_id}</span>
              <span style={{ color: 'var(--c-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 12 }}>{summary}</span>
              <span style={{ textAlign: 'right', color }}>{sceneStatus}</span>
            </div>
            {sceneStatus === 'running' && activeJob.current_shot_id && (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--c-run)', paddingLeft: 64 }}>
                shot: {activeJob.current_shot_id}
              </div>
            )}
          </div>
        ))}

        {planScenes.length === 0 && (
          <div style={{ padding: '20px 28px', color: 'var(--c-muted)', fontSize: 13 }}>
            No plan attached. Job progress visible when scene list is available.
          </div>
        )}

        {isDone && (
          <div style={{ margin: '16px 28px 0', padding: '10px 14px', border: `1px solid ${statusColor(activeJob.status)}55`, borderRadius: 4, color: statusColor(activeJob.status), fontSize: 13, fontFamily: 'var(--font-mono)' }}>
            Job {activeJob.status}{activeJob.result_id ? ` · result ${activeJob.result_id}` : ''}
          </div>
        )}

        <div style={{ padding: '16px 28px 0', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--c-dim)' }}>
          Per-shot logs will appear here in a future release.
        </div>
      </div>
    </div>
  );
}
