'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useProduceStore } from '@/lib/produce-store';
import { gcsUriToStoragePath } from '@/lib/api-v2';

const K = {
  ok: '#4FBF8B', run: '#5BA8E0', fail: '#E2685C', warn: '#CDB65A', amber: '#E8A23A',
  text: '#E4E8EB', mute: '#8C96A0', dim: '#5E6872',
};

function statusColor(s: string): string {
  if (s === 'succeeded') return K.ok;
  if (s === 'failed') return K.fail;
  if (s === 'partial') return K.warn;
  if (s === 'canceled') return K.dim;
  return K.mute;
}

function pad(n: number) { return String(n).padStart(2, '0'); }
function fmtS(n: number) { return (n % 1 ? n.toFixed(1) : String(n)) + 's'; }
function usd(v: number | null | undefined): string { return v == null ? 'unknown' : `$${v.toFixed(2)}`; }

const SECTION_HEADER: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  letterSpacing: '.06em',
  textTransform: 'uppercase',
  color: 'var(--c-muted)',
  borderBottom: '1px solid var(--c-border)',
  paddingBottom: 6,
  marginBottom: 0,
};

export function ResultPage() {
  const router = useRouter();
  const videoResult = useProduceStore(s => s.videoResult);
  const resSel = useProduceStore(s => s.resSel);
  const setResSel = useProduceStore(s => s.setResSel);
  const regenSel = useProduceStore(s => s.regenSel);
  const toggleRegenSel = useProduceStore(s => s.toggleRegenSel);
  const scenes = useProduceStore(s => s.scenes);
  const baseUrl = useProduceStore(s => s.baseUrl);

  if (!videoResult) {
    return (
      <div style={{ margin: '60px auto', maxWidth: 420, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', padding: '0 20px' }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--c-text)' }}>No result yet</div>
        <div style={{ color: 'var(--c-muted)', fontSize: 13.5 }}>Finished jobs write an attempt ledger that can&apos;t be changed: source clips, keyframes, and takes with their dependencies.</div>
        <Link href="/plan" style={{ background: 'transparent', border: '1px solid var(--c-accent)', color: 'var(--c-accent)', padding: '8px 12px', borderRadius: 4, fontSize: 13, textDecoration: 'none' }}>
          Go to Plan →
        </Link>
      </div>
    );
  }

  const sortedScenes = [...videoResult.scenes].sort((a, b) => a.order - b.order);
  const selIdx = Math.min(resSel, sortedScenes.length - 1);
  const cur = sortedScenes[selIdx];
  const nSel = Object.values(regenSel).filter(Boolean).length;

  function streamUrl(uri: string): string | null {
    const path = gcsUriToStoragePath(uri);
    if (!path) return null;
    return `${baseUrl}/storage/stream?path=${encodeURIComponent(path)}`;
  }

  // Get preview asset for selected scene
  const previewTake = cur?.takes[0];
  const previewAsset = previewTake?.preview_asset_id
    ? videoResult.preview_assets.find(a => a.asset_id === previewTake.preview_asset_id)
    : null;
  const previewUrl = previewAsset?.uri ? streamUrl(previewAsset.uri) : null;

  // Cost summary across all attempts
  const allAttempts = videoResult.scenes.flatMap(sc => sc.attempts);
  const totalEst = allAttempts.reduce((sum, a) => sum + (a.billing.estimated_usd ?? 0), 0);
  const totalAct = allAttempts.reduce((sum, a) => sum + (a.billing.actual_usd ?? 0), 0);
  const hasUncertain = allAttempts.some(a => a.billing.actual_usd == null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', padding: '20px 28px 16px', borderBottom: '1px solid var(--c-border)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.06em', color: 'var(--c-muted)' }}>
            05 · GET /v2/jobs/{'{id}'}/result
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--c-text)' }}>Result</h1>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--c-accent)' }}>{videoResult.result_id}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 8px', border: `1px solid ${statusColor(videoResult.terminal_status)}55`, borderRadius: 3, fontFamily: 'var(--font-mono)', fontSize: 11, color: statusColor(videoResult.terminal_status) }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor(videoResult.terminal_status) }} />
              {videoResult.terminal_status}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 22, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--c-muted)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><span>estimated_usd</span><span style={{ fontSize: 15, color: 'var(--c-text)' }}>{usd(totalEst)}</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><span>actual_usd</span><span style={{ fontSize: 15, color: 'var(--c-text)' }}>{usd(totalAct)}{hasUncertain ? ' + uncertain' : ''}</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><span>attempts</span><span style={{ fontSize: 15, color: 'var(--c-text)' }}>{allAttempts.length}</span></div>
        </div>
      </div>

      {/* Body: left scene list + right detail */}
      <div style={{ display: 'flex', flexWrap: 'wrap', flex: 1, minHeight: 0 }}>
        {/* Scene list */}
        <div style={{ flex: '0 0 220px', borderRight: '1px solid var(--c-border)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--c-muted)', letterSpacing: '.06em' }}>
            SCENES · check to regenerate
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {sortedScenes.map((rsc, i) => {
              const draft = scenes.find(s => s.id === rsc.scene_id);
              const summary = draft?.summary || rsc.scene_id;
              const isActive = i === selIdx;
              const isChecked = !!regenSel[rsc.scene_id];
              const take = rsc.takes[0];
              return (
                <div
                  key={rsc.scene_id}
                  style={{ display: 'flex', gap: 10, padding: '10px 16px 10px 13px', borderLeft: `3px solid ${isActive ? 'var(--c-accent)' : 'transparent'}`, background: isActive ? '#161A1F' : 'transparent', borderBottom: '1px solid #1A1F25', alignItems: 'flex-start' }}
                >
                  {/* Checkbox */}
                  <div
                    onClick={() => toggleRegenSel(rsc.scene_id)}
                    style={{ width: 14, height: 14, marginTop: 2, border: `1.5px solid ${isChecked ? 'var(--c-accent)' : 'var(--c-dim)'}`, background: isChecked ? 'var(--c-accent)' : 'transparent', borderRadius: 2, cursor: 'pointer', flexShrink: 0 }}
                  />
                  {/* Scene info */}
                  <div onClick={() => setResSel(i)} style={{ flex: 1, minWidth: 0, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 13, lineHeight: 1.35, color: 'var(--c-text)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--c-accent)' }}>{pad(rsc.order + 1)}</span>{' '}{summary}
                    </span>
                    <span style={{ display: 'flex', gap: 8, fontFamily: 'var(--font-mono)', fontSize: 10.5 }}>
                      <span style={{ color: statusColor(rsc.status) }}>{rsc.status}</span>
                      <span style={{ color: 'var(--c-dim)' }}>{take?.take_id || `${rsc.attempts.length} attempts`}</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          {/* Regen button */}
          <div style={{ padding: 14 }}>
            <button
              onClick={() => { if (nSel > 0) router.push('/regenerate'); }}
              style={{ width: '100%', background: nSel > 0 ? 'var(--c-accent)' : 'var(--c-border)', border: 'none', color: nSel > 0 ? '#17110A' : 'var(--c-dim)', padding: '9px 12px', borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: nSel > 0 ? 'pointer' : 'default' }}
            >
              {nSel > 0 ? `Regenerate ${nSel} scene${nSel > 1 ? 's' : ''} →` : 'Select scenes to regenerate'}
            </button>
          </div>
        </div>

        {/* Scene detail */}
        {cur && (
          <div style={{ flex: '1 1 420px', padding: '20px 24px 48px', display: 'flex', flexDirection: 'column', gap: 22, minWidth: 0, overflowY: 'auto' }}>
            {/* Video preview */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 880 }}>
              <div style={{ aspectRatio: '16/9', background: 'repeating-linear-gradient(135deg,#13171B 0 10px,#171C21 10px 20px)', border: '1px solid var(--c-border)', borderRadius: 4, position: 'relative', overflow: 'hidden' }}>
                {previewUrl ? (
                  <video src={previewUrl} controls style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                ) : (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--c-dim)' }}>
                    {previewTake ? 'Preview loading…' : 'No preview — scene has no take'}
                  </div>
                )}
                <span style={{ position: 'absolute', top: 10, left: 12, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--c-muted)' }}>
                  scene {pad(cur.order + 1)} preview
                </span>
              </div>
              {/* Clip timeline */}
              {cur.clips.length > 0 && (
                <div style={{ position: 'relative', display: 'flex', gap: 2, height: 22 }}>
                  {cur.clips.map(cl => (
                    <div key={cl.clip_id} style={{ flex: 1, background: 'var(--c-border)', borderRadius: 2, display: 'flex', alignItems: 'center', padding: '0 6px', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--c-muted)', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {cl.clip_id}
                    </div>
                  ))}
                </div>
              )}
              {cur.warnings.length > 0 && (
                <div style={{ fontSize: 12.5, color: 'var(--c-warn)' }}>{cur.warnings.join(' · ')}</div>
              )}
            </div>

            {/* Takes */}
            <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={SECTION_HEADER}>Takes</div>
              {cur.takes.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--c-muted)' }}>No take. Every attempt failed. Select this scene for regeneration.</div>
              ) : (
                cur.takes.map(tk => (
                  <div key={tk.take_id} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: '10px 18px', padding: '10px 12px', border: '1px solid var(--c-border)', borderRadius: 4, background: 'var(--c-surface)', fontFamily: 'var(--font-mono)', fontSize: 11.5 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><span style={{ color: 'var(--c-dim)', fontSize: 10 }}>take_id</span><span style={{ color: 'var(--c-accent)' }}>{tk.take_id}</span></div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><span style={{ color: 'var(--c-dim)', fontSize: 10 }}>clips</span><span>{tk.clip_ids.length}</span></div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><span style={{ color: 'var(--c-dim)', fontSize: 10 }}>nominal / measured</span><span>{fmtS(tk.nominal_duration_s)} / {fmtS(tk.measured_duration_s)}</span></div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><span style={{ color: 'var(--c-dim)', fontSize: 10 }}>depends_on</span><span style={{ wordBreak: 'break-all' }}>{tk.depends_on_take_ids.join(', ') || '—'}</span></div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><span style={{ color: 'var(--c-dim)', fontSize: 10 }}>supersedes</span><span style={{ wordBreak: 'break-all' }}>{tk.supersedes_take_ids.join(', ') || '—'}</span></div>
                  </div>
                ))
              )}
            </section>

            {/* Attempt ledger */}
            <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={SECTION_HEADER}>Attempt Ledger</div>
              <div style={{ overflowX: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '150px 36px 80px 160px 86px 70px 70px minmax(200px,1fr)', minWidth: 900, fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.05em', color: 'var(--c-dim)', paddingBottom: 6 }}>
                  <span>ATTEMPT_ID</span><span>#</span><span>PROVIDER</span><span>PROVIDER_REQUEST_ID</span><span>STATUS</span><span style={{ textAlign: 'right' }}>EST</span><span style={{ textAlign: 'right' }}>ACTUAL</span><span style={{ paddingLeft: 14 }}>FALLBACK / ERROR</span>
                </div>
                {cur.attempts.length === 0 && (
                  <div style={{ color: 'var(--c-muted)', fontSize: 13 }}>No attempts recorded.</div>
                )}
                {cur.attempts.map(att => {
                  const reqId = att.provider_request_id || '—';
                  const reqIdShort = reqId.length > 18 ? reqId.slice(0, 15) + '…' : reqId;
                  const noteColor = att.error ? 'var(--c-fail)' : att.fallback_from_attempt_id ? 'var(--c-amber)' : 'var(--c-dim)';
                  const note = att.error ? `${att.error.code}: ${att.error.message}` : att.fallback_from_attempt_id ? `fallback_from ${att.fallback_from_attempt_id.slice(0, 20)}…` : '—';
                  return (
                    <div key={att.attempt_id} style={{ display: 'grid', gridTemplateColumns: '150px 36px 80px 160px 86px 70px 70px minmax(200px,1fr)', minWidth: 900, fontFamily: 'var(--font-mono)', fontSize: 11, padding: '7px 0', borderTop: '1px solid #1A1F25', alignItems: 'start' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.attempt_id.slice(0, 18)}…</span>
                      <span style={{ color: 'var(--c-muted)' }}>{att.attempt_number}</span>
                      <span>{att.provider}</span>
                      <span style={{ color: 'var(--c-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{reqIdShort}</span>
                      <span style={{ color: statusColor(att.status) }}>{att.status}</span>
                      <span style={{ textAlign: 'right', color: 'var(--c-muted)' }}>{usd(att.billing.estimated_usd)}</span>
                      <span style={{ textAlign: 'right' }}>{usd(att.billing.actual_usd)}</span>
                      <span style={{ paddingLeft: 14, color: noteColor, lineHeight: 1.4, wordBreak: 'break-all' }}>{note}</span>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Source clips */}
            {cur.clips.length > 0 && (
              <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={SECTION_HEADER}>Source Clips</div>
                {cur.clips.map(cl => (
                  <div key={cl.clip_id} style={{ display: 'grid', gridTemplateColumns: '170px 170px 90px minmax(0,1fr)', gap: 10, fontFamily: 'var(--font-mono)', fontSize: 11, padding: '6px 0', borderTop: '1px solid #1A1F25' }}>
                    <span style={{ color: 'var(--c-text)' }}>{cl.clip_id}</span>
                    <span style={{ color: 'var(--c-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cl.attempt_id}</span>
                    <span style={{ color: 'var(--c-dim)' }}>{cl.asset?.sha256 ? cl.asset.sha256.slice(7, 20) + '…' : '—'}</span>
                    <span style={{ color: 'var(--c-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cl.asset?.mime_type || '—'}</span>
                  </div>
                ))}
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
