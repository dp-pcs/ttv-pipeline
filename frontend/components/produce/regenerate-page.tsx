'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useProduceStore } from '@/lib/produce-store';
import { buildMultiSceneRequest, createPlan, ApiV2Error } from '@/lib/api-v2';
import { useToast } from '@/hooks/use-toast';

const K = { ok: '#4FBF8B', fail: '#E2685C', warn: '#CDB65A', amber: '#E8A23A', text: '#E4E8EB', mute: '#8C96A0', dim: '#5E6872' };

function pad(n: number) { return String(n).padStart(2, '0'); }

function statusColor(s: string): string {
  if (s === 'succeeded') return K.ok;
  if (s === 'failed') return K.fail;
  if (s === 'partial') return K.warn;
  return K.mute;
}

const SECTION_HEADER: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  letterSpacing: '.06em',
  color: 'var(--c-muted)',
  borderBottom: '1px solid var(--c-border)',
  paddingBottom: 6,
};

type Decision = 'accept_stale' | 'use_boundary' | 'regenerate';
const DECISION_OPTS: Decision[] = ['accept_stale', 'use_boundary', 'regenerate'];

export function RegeneratePage() {
  const router = useRouter();
  const { toast } = useToast();

  const videoResult = useProduceStore(s => s.videoResult);
  const regenSel = useProduceStore(s => s.regenSel);
  const regenReason = useProduceStore(s => s.regenReason);
  const setRegenReason = useProduceStore(s => s.setRegenReason);
  const continuityDecisions = useProduceStore(s => s.continuityDecisions);
  const setContinuityDecision = useProduceStore(s => s.setContinuityDecision);
  const scenes = useProduceStore(s => s.scenes);
  const revision = useProduceStore(s => s.revision);
  const incrementRevision = useProduceStore(s => s.incrementRevision);
  const setPlan = useProduceStore(s => s.setPlan);
  const projectId = useProduceStore(s => s.projectId);

  const [submitting, setSubmitting] = useState(false);

  const sortedResultScenes = videoResult ? [...videoResult.scenes].sort((a, b) => a.order - b.order) : [];
  const selectedScenes = sortedResultScenes.filter(rsc => regenSel[rsc.scene_id]);

  if (!videoResult || selectedScenes.length === 0) {
    return (
      <div style={{ margin: '60px auto', maxWidth: 420, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', padding: '0 20px' }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--c-text)' }}>Nothing selected</div>
        <div style={{ color: 'var(--c-muted)', fontSize: 13.5 }}>
          Pick scenes on the Result screen. The new request includes only those scenes and names the prior result and the takes it replaces.
        </div>
        <Link href="/result" style={{ background: 'transparent', border: '1px solid var(--c-accent)', color: 'var(--c-accent)', padding: '8px 12px', borderRadius: 4, fontSize: 13, textDecoration: 'none' }}>
          Go to result →
        </Link>
      </div>
    );
  }

  // Dependent scenes: not selected, mode=continue_from_previous, and the previous scene (by order) IS selected
  const dependents = sortedResultScenes
    .map((rsc, i) => ({ rsc, i }))
    .filter(({ rsc, i }) => {
      if (regenSel[rsc.scene_id]) return false;
      const draft = scenes.find(s => s.id === rsc.scene_id);
      if (draft?.mode !== 'continue_from_previous') return false;
      if (i === 0) return false;
      const prev = sortedResultScenes[i - 1];
      return !!regenSel[prev.scene_id];
    })
    .map(({ rsc, i }) => {
      const prev = sortedResultScenes[i - 1];
      const draft = scenes.find(s => s.id === rsc.scene_id);
      return {
        scene_id: rsc.scene_id,
        n: pad(rsc.order + 1),
        summary: draft?.summary || rsc.scene_id,
        depTakeId: prev.takes[0]?.take_id || prev.scene_id,
      };
    });

  const supersedes = selectedScenes.flatMap(rsc => rsc.takes.map(t => t.take_id));

  const continuityDecisionsPayload = dependents.map(d => ({
    dependency_take_id: d.depTakeId,
    scene_id: d.scene_id,
    decision: continuityDecisions[d.scene_id] || 'accept_stale',
  }));

  const regenJson = JSON.stringify(
    {
      base_result_ids: [videoResult.result_id],
      supersedes_take_ids: supersedes,
      reason: regenReason,
      continuity_decisions: continuityDecisionsPayload,
    },
    null,
    2
  );

  const nextRev = revision + 1;

  const handleSubmit = async () => {
    const extraIds = dependents.filter(d => continuityDecisions[d.scene_id] === 'regenerate').map(d => d.scene_id);
    const ids = new Set([...selectedScenes.map(s => s.scene_id), ...extraIds]);
    const sceneDrafts = scenes.filter(s => ids.has(s.id));

    if (sceneDrafts.length === 0) {
      toast({ variant: 'destructive', title: 'Nothing to regenerate', description: 'No matching scene drafts found.' });
      return;
    }

    setSubmitting(true);
    try {
      const request = await buildMultiSceneRequest(sceneDrafts, {
        projectId,
        revision: nextRev,
        storyboardRevisionId: `storyboard-${Date.now()}`,
        regeneration: {
          base_result_ids: [videoResult.result_id],
          supersedes_take_ids: supersedes,
          reason: regenReason,
        },
      });
      const newPlan = await createPlan(request);
      incrementRevision();
      setPlan(newPlan);
      router.push('/plan');
    } catch (err) {
      const msg = err instanceof ApiV2Error ? err.message : 'Failed to create regeneration plan';
      toast({ variant: 'destructive', title: 'Regeneration failed', description: msg });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', padding: '20px 28px 16px', borderBottom: '1px solid var(--c-border)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.06em', color: 'var(--c-muted)' }}>
            06 · GENERATIONREQUEST.regeneration
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--c-text)' }}>Regenerate scenes</h1>
        </div>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          style={{ background: submitting ? 'var(--c-border)' : 'var(--c-accent)', border: 'none', color: submitting ? 'var(--c-dim)' : '#17110A', padding: '9px 14px', borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: submitting ? 'default' : 'pointer' }}
        >
          {submitting ? 'Planning…' : `Create r${nextRev} request → plan`}
        </button>
      </div>

      {/* Body */}
      <div style={{ padding: '20px 28px 40px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 28 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22, minWidth: 0 }}>
          {/* Scenes in this request */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={SECTION_HEADER}>Scenes in this request</div>
            {selectedScenes.map(rsc => {
              const draft = scenes.find(s => s.id === rsc.scene_id);
              const supersedeIds = rsc.takes.map(t => t.take_id).join(', ') || '—';
              return (
                <div key={rsc.scene_id} style={{ display: 'grid', gridTemplateColumns: '36px minmax(0,1fr) auto', gap: 10, padding: '10px 0', borderTop: '1px solid #1A1F25', alignItems: 'center' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--c-accent)' }}>{pad(rsc.order + 1)}</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                    <span style={{ fontSize: 13.5, color: 'var(--c-text)' }}>{draft?.summary || rsc.scene_id}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--c-dim)' }}>supersedes {supersedeIds}</span>
                  </div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: statusColor(rsc.status) }}>{rsc.status}</span>
                </div>
              );
            })}
          </section>

          {/* Continuity decisions */}
          {dependents.length > 0 && (
            <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={SECTION_HEADER}>Continuity decisions · downstream takes that depend on a replaced take</div>
              {dependents.map(d => {
                const decision = continuityDecisions[d.scene_id] || 'accept_stale';
                return (
                  <div key={d.scene_id} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, border: '1px solid var(--c-border)', borderRadius: 4, background: 'var(--c-surface)' }}>
                    <div style={{ fontSize: 13, color: 'var(--c-text)' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--c-accent)', fontSize: 11 }}>{d.n}</span> {d.summary}{' '}
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--c-dim)' }}>depends on {d.depTakeId}</span>
                    </div>
                    <div style={{ display: 'flex', border: '1px solid var(--c-border2)', borderRadius: 4, overflow: 'hidden', alignSelf: 'flex-start' }}>
                      {DECISION_OPTS.map(opt => (
                        <div
                          key={opt}
                          onClick={() => setContinuityDecision(d.scene_id, opt)}
                          style={{ padding: '6px 11px', fontFamily: 'var(--font-mono)', fontSize: 11.5, background: decision === opt ? '#2A313A' : 'transparent', color: decision === opt ? 'var(--c-text)' : 'var(--c-muted)', cursor: 'pointer' }}
                        >
                          {opt}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </section>
          )}

          {/* Reason */}
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.06em', color: 'var(--c-muted)' }}>REASON</span>
            <textarea
              value={regenReason}
              onChange={e => setRegenReason(e.target.value)}
              rows={3}
              style={{ background: 'var(--c-bg)', border: '1px solid var(--c-border2)', borderRadius: 4, color: 'var(--c-text)', padding: 10, fontSize: 14, resize: 'vertical', outline: 'none', fontFamily: 'inherit' }}
            />
          </label>
        </div>

        {/* JSON preview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.06em', color: 'var(--c-muted)' }}>regeneration</div>
          <pre style={{ margin: 0, background: 'var(--c-bg)', border: '1px solid var(--c-border)', borderRadius: 4, padding: 12, fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: 1.55, color: 'var(--c-muted)', overflow: 'auto', whiteSpace: 'pre' }}>
            {regenJson}
          </pre>
        </div>
      </div>
    </div>
  );
}
