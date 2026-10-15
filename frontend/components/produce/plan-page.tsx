'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useProduceStore } from '@/lib/produce-store';
import {
  buildApproval,
  approvePlan,
  planNeedsUnknownCostAck,
  ApiV2Error,
  type Variant,
} from '@/lib/api-v2';
import { useToast } from '@/hooks/use-toast';

const K = {
  ok: '#4FBF8B',
  fail: '#E2685C',
  warn: '#CDB65A',
  amber: '#E8A23A',
  text: '#E4E8EB',
  mute: '#8C96A0',
  dim: '#5E6872',
};

function fmtS(n: number): string {
  return (n % 1 ? n.toFixed(1) : String(n)) + 's';
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function fmtT(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
}

function usd(v: number | null | undefined): string {
  return v == null ? 'unknown' : `$${v.toFixed(2)}`;
}

function chip(status: string): { label: string; color: string } {
  const map: Record<string, string> = { ready: K.ok, blocked: K.fail };
  return { label: status, color: map[status] || K.mute };
}

const sectionLabel: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: '11px',
  letterSpacing: '.06em',
  color: 'var(--c-muted)',
};

const mono: React.CSSProperties = { fontFamily: 'var(--font-mono)' };

type LayoutMode = 'timeline' | 'grid' | 'ledger';

export function PlanPage() {
  const router = useRouter();
  const { toast } = useToast();
  const plan = useProduceStore((s) => s.plan);
  const chosenVariants = useProduceStore((s) => s.chosenVariants);
  const setChosenVariant = useProduceStore((s) => s.setChosenVariant);
  const executionMode = useProduceStore((s) => s.executionMode);
  const setExecutionMode = useProduceStore((s) => s.setExecutionMode);
  const budget = useProduceStore((s) => s.budget);
  const setBudget = useProduceStore((s) => s.setBudget);
  const allowUnknownCost = useProduceStore((s) => s.allowUnknownCost);
  const setAllowUnknownCost = useProduceStore((s) => s.setAllowUnknownCost);
  const kfResult = useProduceStore((s) => s.kfResult);
  const useKfResult = useProduceStore((s) => s.useKfResult);
  const setUseKfResult = useProduceStore((s) => s.setUseKfResult);
  const setActiveJob = useProduceStore((s) => s.setActiveJob);

  const [layout, setLayout] = useState<LayoutMode>('timeline');
  const [approving, setApproving] = useState(false);

  const planScenes = useMemo(() => {
    if (!plan) return [];
    let t0 = 0;
    return plan.scenes
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((ps) => {
        const start = t0;
        t0 += ps.requested_duration_s;
        return { ...ps, rangeStart: start, rangeEnd: t0 };
      });
  }, [plan]);

  if (!plan) {
    return (
      <div
        style={{
          margin: '60px auto',
          maxWidth: 420,
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          alignItems: 'center',
          padding: '0 20px',
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--c-text)' }}>No plan yet</div>
        <div style={{ color: 'var(--c-muted)', fontSize: 13.5 }}>
          Compose your scenes and request a plan before you can review and approve variants.
        </div>
        <Link
          href="/"
          style={{
            background: 'transparent',
            border: '1px solid var(--c-accent)',
            color: 'var(--c-accent)',
            padding: '8px 12px',
            borderRadius: 4,
            fontSize: 13,
            textDecoration: 'none',
          }}
        >
          Go to Compose →
        </Link>
      </div>
    );
  }

  function chosen(ps: (typeof planScenes)[number]): Variant | undefined {
    const id = chosenVariants[ps.scene_id];
    return ps.variants.find((v) => v.variant_id === id) || ps.variants[0];
  }

  const validMinutes = (() => {
    try {
      const ms = new Date(plan.valid_until).getTime() - Date.now();
      return Math.max(0, Math.round(ms / 60000));
    } catch {
      return 0;
    }
  })();

  // Cost summary
  let known = 0;
  let unknownCount = 0;
  const selSummary: Array<{ n: string; name: string; cost: string; costColor: string }> = [];
  const errors: string[] = [];

  planScenes.forEach((ps) => {
    const v = chosen(ps);
    if (!v) {
      errors.push(`${ps.scene_id} has no viable variant`);
      return;
    }
    const amount = v.estimated_cost.amount;
    if (executionMode === 'keyframes') {
      unknownCount++;
    } else if (amount == null) {
      unknownCount++;
    } else {
      known += amount;
    }
    selSummary.push({
      n: pad(ps.order + 1),
      name: v.provider,
      cost: executionMode === 'keyframes' ? 'img' : usd(amount),
      costColor: executionMode === 'keyframes' || amount == null ? K.warn : K.text,
    });
  });

  const budgetNum = parseFloat(budget) || 0;
  const needsUnknownAck = planNeedsUnknownCostAck(plan);
  if ((unknownCount > 0 || needsUnknownAck) && !allowUnknownCost) {
    errors.push(`${unknownCount || ''} operation(s) have no cost estimate. Turn on allow_unknown_cost.`.replace('  ', ' '));
  }
  if (known > budgetNum && executionMode === 'video') {
    errors.push(`Estimate ${usd(known)} exceeds max_estimated_cost_usd ${usd(budgetNum)}`);
  }
  if (plan.status === 'blocked') {
    errors.push('Plan is blocked. Resolve blocked scenes before approving.');
  }

  const canApprove = errors.length === 0 && !approving;
  const budgetPct = Math.min(100, budgetNum ? (known / budgetNum) * 100 : 0);

  async function handleApprove() {
    if (!plan || !canApprove) return;
    setApproving(true);
    try {
      const approvedVariantIds = planScenes
        .map((ps) => chosen(ps)?.variant_id)
        .filter((id): id is string => !!id);
      const approval = await buildApproval(plan, approvedVariantIds, executionMode, allowUnknownCost);
      const job = await approvePlan(approval);
      setActiveJob(job);
      router.push('/run');
    } catch (err) {
      const message = err instanceof ApiV2Error ? err.message : 'Failed to approve plan';
      toast({ variant: 'destructive', title: 'Approval failed', description: message });
    } finally {
      setApproving(false);
    }
  }

  const layoutOpts: Array<{ value: LayoutMode; label: string }> = [
    { value: 'timeline', label: 'Timeline' },
    { value: 'grid', label: 'Storyboard grid' },
    { value: 'ledger', label: 'Ledger' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
          padding: '20px 28px 16px',
          borderBottom: '1px solid var(--c-border)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ ...sectionLabel }}>02 · POST /v2/plans → GENERATIONPLAN</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--c-text)' }}>
              Plan &amp; approve
            </h1>
            <span style={{ ...mono, fontSize: 12, color: 'var(--c-accent)' }}>{plan.plan_id}</span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '2px 8px',
                border: `1px solid ${chip(plan.status).color}55`,
                borderRadius: 3,
                ...mono,
                fontSize: 11,
                color: chip(plan.status).color,
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: chip(plan.status).color }} />
              {chip(plan.status).label}
            </span>
            <span style={{ ...mono, fontSize: 11, color: 'var(--c-muted)' }}>valid for {validMinutes}m</span>
          </div>
        </div>
        <div style={{ display: 'flex', border: '1px solid var(--c-border2)', borderRadius: 4, overflow: 'hidden' }}>
          {layoutOpts.map((o) => (
            <div
              key={o.value}
              onClick={() => setLayout(o.value)}
              style={{
                padding: '7px 14px',
                fontSize: 12.5,
                fontWeight: 500,
                cursor: 'pointer',
                background: layout === o.value ? '#2A313A' : 'transparent',
                color: layout === o.value ? 'var(--c-text)' : 'var(--c-muted)',
              }}
            >
              {o.label}
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', flex: 1, minHeight: 0, alignItems: 'flex-start' }}>
        {/* Main content */}
        <div style={{ flex: '1 1 480px', padding: '20px 24px 40px', display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
          {plan.blocked_reasons.length > 0 && (
            <div style={{ border: '1px solid var(--c-border)', borderRadius: 6, background: 'var(--c-surface)' }}>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '4px 16px',
                  justifyContent: 'space-between',
                  padding: '9px 14px',
                  borderBottom: '1px solid var(--c-border)',
                  ...mono,
                  fontSize: 11,
                  letterSpacing: '.06em',
                  color: 'var(--c-muted)',
                }}
              >
                <span>BLOCKED_REASONS · {plan.blocked_reasons.length}</span>
                <span>variants excluded from this plan</span>
              </div>
              {plan.blocked_reasons.map((b, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '3px 12px',
                    padding: '8px 14px',
                    borderBottom: '1px solid #1A1F25',
                    fontSize: 12.5,
                  }}
                >
                  <span style={{ ...mono, fontSize: 11, color: 'var(--c-muted)', width: 90 }}>{b.scene_id || '—'}</span>
                  <span style={{ ...mono, fontSize: 11, color: 'var(--c-fail)', width: 180 }}>{b.code}</span>
                  <span style={{ color: '#C4CBD2', flex: '1 1 240px', minWidth: 0 }}>{b.message}</span>
                </div>
              ))}
            </div>
          )}

          {layout === 'timeline' && (
            <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 6 }}>
              {planScenes.map((ps) => {
                const cv = chosen(ps);
                return (
                  <div key={ps.scene_id} style={{ flex: `${ps.requested_duration_s} 1 0`, minWidth: 250, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                        paddingBottom: 10,
                        borderBottom: `2px solid ${ps.variants.length ? 'var(--c-border2)' : K.fail}`,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', ...mono, fontSize: 10.5, color: 'var(--c-dim)' }}>
                        <span>{fmtT(ps.rangeStart)}–{fmtT(ps.rangeEnd)}</span>
                        <span>{fmtS(ps.requested_duration_s)}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                        <span style={{ ...mono, fontSize: 11, color: 'var(--c-accent)' }}>{pad(ps.order + 1)}</span>
                        <span style={{ fontSize: 13.5, fontWeight: 500, lineHeight: 1.3 }}>{ps.scene_id}</span>
                      </div>
                    </div>
                    {ps.variants.length === 0 && (
                      <div style={{ padding: 12, border: '1px dashed var(--c-fail)', borderRadius: 4, color: 'var(--c-fail)', fontSize: 12.5 }}>
                        No viable variant. Scene is blocked.
                      </div>
                    )}
                    {ps.variants.map((v) => {
                      const selected = cv?.variant_id === v.variant_id;
                      return (
                        <div
                          key={v.variant_id}
                          onClick={() => setChosenVariant(ps.scene_id, v.variant_id)}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 8,
                            padding: '10px 11px',
                            border: `1px solid ${selected ? 'var(--c-accent)' : 'var(--c-border)'}`,
                            background: selected ? 'var(--c-amber-bg)' : 'var(--c-surface)',
                            borderRadius: 5,
                            cursor: 'pointer',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span
                              style={{
                                width: 10,
                                height: 10,
                                borderRadius: '50%',
                                border: `1.5px solid ${selected ? 'var(--c-accent)' : 'var(--c-border2)'}`,
                                background: selected ? 'var(--c-accent)' : 'transparent',
                                flexShrink: 0,
                              }}
                            />
                            <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{v.provider}</span>
                            <span style={{ ...mono, fontSize: 12.5, color: v.estimated_cost.amount == null ? K.warn : 'var(--c-text)' }}>
                              {usd(v.estimated_cost.amount)}
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', ...mono, fontSize: 10.5, color: 'var(--c-muted)' }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.model}</span>
                            <span style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                              {([
                                ['FF', v.capability_snapshot.supports_first_frame],
                                ['LF', v.capability_snapshot.supports_last_frame],
                                ['AU', v.capability_snapshot.supports_audio],
                              ] as const).map(([l, on]) => (
                                <span key={l} style={{ color: on ? 'var(--c-text)' : '#3A434E' }}>{l}</span>
                              ))}
                            </span>
                          </div>
                          <div style={{ ...mono, fontSize: 10.5, color: 'var(--c-dim)' }}>{v.shots.length} shot(s)</div>
                          {ps.warnings.length > 0 && (
                            <div style={{ fontSize: 11.5, color: 'var(--c-warn)', lineHeight: 1.35 }}>{ps.warnings.join(' · ')}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}

          {layout === 'grid' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(360px,1fr))', gap: 16 }}>
              {planScenes.map((ps) => {
                const cv = chosen(ps);
                return (
                  <div key={ps.scene_id} style={{ border: '1px solid var(--c-border)', borderRadius: 6, background: 'var(--c-surface)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <div
                      style={{
                        aspectRatio: '16/7',
                        background: 'repeating-linear-gradient(135deg,#161B20 0 8px,#1A1F25 8px 16px)',
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'flex-end',
                        padding: '10px 12px',
                      }}
                    >
                      <span style={{ position: 'absolute', top: 10, left: 12, ...mono, fontSize: 10.5, color: 'var(--c-dim)' }}>scene reference / first frame</span>
                      <span style={{ position: 'absolute', top: 10, right: 12, ...mono, fontSize: 10.5, color: 'var(--c-muted)' }}>{fmtT(ps.rangeStart)}–{fmtT(ps.rangeEnd)}</span>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                        <span style={{ ...mono, fontSize: 12, color: 'var(--c-accent)' }}>{pad(ps.order + 1)}</span>
                        <span style={{ fontSize: 15, fontWeight: 600 }}>{ps.scene_id}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid var(--c-border)', ...mono, fontSize: 10.5 }}>
                      <span style={{ color: 'var(--c-muted)' }}>{fmtS(ps.requested_duration_s)}</span>
                    </div>
                    {ps.variants.map((v) => {
                      const selected = cv?.variant_id === v.variant_id;
                      return (
                        <div
                          key={v.variant_id}
                          onClick={() => setChosenVariant(ps.scene_id, v.variant_id)}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '14px minmax(0,1fr) auto',
                            gap: 10,
                            alignItems: 'center',
                            padding: '9px 12px',
                            borderBottom: '1px solid #1A1F25',
                            background: selected ? 'var(--c-amber-bg)' : 'transparent',
                            cursor: 'pointer',
                          }}
                        >
                          <span
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: '50%',
                              border: `1.5px solid ${selected ? 'var(--c-accent)' : 'var(--c-border2)'}`,
                              background: selected ? 'var(--c-accent)' : 'transparent',
                            }}
                          />
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                            <span style={{ fontSize: 13, fontWeight: 500 }}>{v.provider}</span>
                            <span style={{ ...mono, fontSize: 10.5, color: 'var(--c-muted)' }}>{v.shots.length} shot(s)</span>
                          </div>
                          <span style={{ ...mono, fontSize: 12.5, color: v.estimated_cost.amount == null ? K.warn : 'var(--c-text)' }}>
                            {usd(v.estimated_cost.amount)}
                          </span>
                        </div>
                      );
                    })}
                    {ps.variants.length === 0 && (
                      <div style={{ padding: 12, color: 'var(--c-fail)', fontSize: 12.5 }}>No viable variant. Scene is blocked.</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {layout === 'ledger' && (
            <div style={{ border: '1px solid var(--c-border)', borderRadius: 6, overflow: 'auto' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '28px 210px 150px minmax(170px,1fr) 90px',
                  minWidth: 760,
                  ...mono,
                  fontSize: 10.5,
                  letterSpacing: '.05em',
                  color: 'var(--c-dim)',
                  background: 'var(--c-surface)',
                  borderBottom: '1px solid var(--c-border)',
                }}
              >
                <span style={{ padding: 8 }} />
                <span style={{ padding: 8 }}>SCENE</span>
                <span style={{ padding: 8 }}>PROVIDER</span>
                <span style={{ padding: 8 }}>MODEL</span>
                <span style={{ padding: 8, textAlign: 'right' }}>EST</span>
              </div>
              {planScenes.map((ps, psi) =>
                ps.variants.map((v, vi) => {
                  const selected = chosen(ps)?.variant_id === v.variant_id;
                  return (
                    <div
                      key={v.variant_id}
                      onClick={() => setChosenVariant(ps.scene_id, v.variant_id)}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '28px 210px 150px minmax(170px,1fr) 90px',
                        minWidth: 760,
                        alignItems: 'center',
                        borderTop: vi === 0 ? '1px solid var(--c-border2)' : '1px solid #1A1F25',
                        background: selected ? 'var(--c-amber-bg)' : psi % 2 ? 'var(--c-surface)' : 'transparent',
                        cursor: 'pointer',
                        fontSize: 12.5,
                      }}
                    >
                      <span style={{ padding: 8 }}>
                        <span
                          style={{
                            display: 'block',
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            border: `1.5px solid ${selected ? 'var(--c-accent)' : 'var(--c-border2)'}`,
                            background: selected ? 'var(--c-accent)' : 'transparent',
                          }}
                        />
                      </span>
                      <span style={{ padding: 8, color: 'var(--c-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {vi === 0 ? (
                          <>
                            <span style={{ ...mono, color: 'var(--c-accent)', fontSize: 11 }}>{pad(ps.order + 1)}</span> {ps.scene_id}
                          </>
                        ) : (
                          ''
                        )}
                      </span>
                      <span style={{ padding: 8 }}>{v.provider}</span>
                      <span style={{ padding: 8, ...mono, fontSize: 11, color: 'var(--c-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {v.model}
                      </span>
                      <span style={{ padding: 8, textAlign: 'right', ...mono, fontSize: 12, color: v.estimated_cost.amount == null ? K.warn : 'var(--c-text)' }}>
                        {usd(v.estimated_cost.amount)}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Approval sidebar */}
        <div
          style={{
            flex: '1 1 280px',
            borderLeft: '1px solid var(--c-border)',
            borderTop: '1px solid var(--c-border)',
            background: 'var(--c-sidebar)',
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            position: 'sticky',
            top: 0,
            alignSelf: 'stretch',
          }}
        >
          <div style={{ ...sectionLabel }}>PLANAPPROVAL</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--c-muted)' }}>execution_mode</span>
            <div style={{ display: 'flex', border: '1px solid var(--c-border2)', borderRadius: 4, overflow: 'hidden' }}>
              {(['video', 'keyframes'] as const).map((m) => (
                <div
                  key={m}
                  onClick={() => setExecutionMode(m)}
                  style={{
                    flex: 1,
                    textAlign: 'center',
                    padding: '7px 10px',
                    fontSize: 12.5,
                    fontWeight: 500,
                    cursor: 'pointer',
                    background: executionMode === m ? '#2A313A' : 'transparent',
                    color: executionMode === m ? 'var(--c-text)' : 'var(--c-muted)',
                  }}
                >
                  {m === 'video' ? 'Video' : 'Keyframes first'}
                </div>
              ))}
            </div>
            <span style={{ fontSize: 11.5, color: 'var(--c-dim)', lineHeight: 1.4 }}>
              {executionMode === 'keyframes'
                ? 'Makes first and last frames only, so you can review them before paying for video. Image work has no cost estimate.'
                : 'Renders every approved variant. Shots in continuing scenes run in sequence.'}
            </span>
          </div>

          {!!kfResult && executionMode === 'video' && (
            <div onClick={() => setUseKfResult(!useKfResult)} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <div style={{ position: 'relative', width: 34, height: 18, borderRadius: 9, background: useKfResult ? 'var(--c-accent)' : 'var(--c-border2)', flexShrink: 0 }}>
                <div style={{ position: 'absolute', top: 2, left: useKfResult ? 18 : 2, width: 14, height: 14, borderRadius: '50%', background: 'var(--c-text)' }} />
              </div>
              <span style={{ ...mono, fontSize: 11, color: 'var(--c-text)' }}>
                approved_keyframe_result_id
                <br />
                <span style={{ color: 'var(--c-muted)' }}>{kfResult.result_id}</span>
              </span>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid var(--c-border)', borderRadius: 4 }}>
            {selSummary.map((a, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '24px minmax(0,1fr) auto', gap: 8, padding: '7px 10px', borderBottom: '1px solid #1A1F25', fontSize: 12.5, alignItems: 'center' }}>
                <span style={{ ...mono, fontSize: 11, color: 'var(--c-accent)' }}>{a.n}</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
                <span style={{ ...mono, fontSize: 12, color: a.costColor }}>{a.cost}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 10px', fontWeight: 600 }}>
              <span>Estimated</span>
              <span style={mono}>{usd(known)}</span>
            </div>
            {unknownCount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 10px 9px', fontSize: 12, color: 'var(--c-warn)' }}>
                <span>+ unknown estimates</span>
                <span style={mono}>{unknownCount}</span>
              </div>
            )}
          </div>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{ fontSize: 12, color: 'var(--c-muted)' }}>max_estimated_cost_usd</span>
            <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--c-border2)', borderRadius: 4, background: 'var(--c-bg)' }}>
              <span style={{ padding: '0 0 0 10px', color: 'var(--c-dim)', ...mono }}>$</span>
              <input
                type="number"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', color: 'var(--c-text)', padding: '8px 10px 8px 4px', ...mono, fontSize: 14, outline: 'none' }}
              />
            </div>
            <div style={{ height: 4, background: 'var(--c-border)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${budgetPct}%`, background: known > budgetNum ? 'var(--c-fail)' : 'var(--c-accent)' }} />
            </div>
          </label>

          <div onClick={() => setAllowUnknownCost(!allowUnknownCost)} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <div style={{ position: 'relative', width: 34, height: 18, borderRadius: 9, background: allowUnknownCost ? 'var(--c-accent)' : 'var(--c-border2)', flexShrink: 0 }}>
              <div style={{ position: 'absolute', top: 2, left: allowUnknownCost ? 18 : 2, width: 14, height: 14, borderRadius: '50%', background: 'var(--c-text)' }} />
            </div>
            <span style={{ ...mono, fontSize: 12, color: 'var(--c-text)' }}>allow_unknown_cost</span>
          </div>

          {errors.map((e, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--c-fail)', lineHeight: 1.4 }}>
              <span style={{ width: 5, height: 5, marginTop: 6, background: 'var(--c-fail)', flexShrink: 0 }} />
              {e}
            </div>
          ))}

          <button
            onClick={handleApprove}
            disabled={!canApprove}
            style={{
              background: canApprove ? 'var(--c-accent)' : 'var(--c-border)',
              border: 'none',
              color: canApprove ? '#17110A' : 'var(--c-dim)',
              padding: '11px 14px',
              borderRadius: 4,
              fontSize: 13.5,
              fontWeight: 600,
              cursor: canApprove ? 'pointer' : 'default',
            }}
          >
            {approving ? 'Approving…' : executionMode === 'keyframes' ? 'Approve keyframes run' : 'Approve & queue video'}
          </button>
          <div style={{ ...mono, fontSize: 10.5, color: 'var(--c-dim)', lineHeight: 1.5 }}>
            POST /v2/jobs binds plan_sha256, approved_variant_ids, execution_mode and budget.
          </div>
        </div>
      </div>
    </div>
  );
}
