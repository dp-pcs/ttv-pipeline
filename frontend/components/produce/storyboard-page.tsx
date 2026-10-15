'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useProduceStore } from '@/lib/produce-store';
import { gcsUriToStoragePath } from '@/lib/api-v2';

function pad(n: number) { return String(n).padStart(2, '0'); }
function fmtS(n: number) { return (n % 1 ? n.toFixed(1) : String(n)) + 's'; }

export function StoryboardPage() {
  const router = useRouter();
  const kfResult = useProduceStore(s => s.kfResult);
  const scenes = useProduceStore(s => s.scenes);
  const plan = useProduceStore(s => s.plan);
  const baseUrl = useProduceStore(s => s.baseUrl);
  const setExecutionMode = useProduceStore(s => s.setExecutionMode);
  const setUseKfResult = useProduceStore(s => s.setUseKfResult);

  const handleApproveFrames = () => {
    setExecutionMode('video');
    setUseKfResult(true);
    router.push('/plan');
  };

  if (!kfResult) {
    return (
      <div style={{ margin: '60px auto', maxWidth: 460, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', padding: '0 20px' }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--c-text)' }}>No keyframe result yet</div>
        <div style={{ color: 'var(--c-muted)', fontSize: 13.5 }}>
          Approve the plan with execution_mode <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--c-text)' }}>keyframes</span> to make first and last frames for every shot. You can review them before paying for video.
        </div>
        <Link href="/plan" style={{ background: 'transparent', border: '1px solid var(--c-accent)', color: 'var(--c-accent)', padding: '8px 12px', borderRadius: 4, fontSize: 13, textDecoration: 'none' }}>
          Go to Plan →
        </Link>
      </div>
    );
  }

  function streamUrl(uri: string): string | null {
    const path = gcsUriToStoragePath(uri);
    if (!path) return null;
    return `${baseUrl}/storage/stream?path=${encodeURIComponent(path)}`;
  }

  const resultScenes = [...kfResult.scenes].sort((a, b) => a.order - b.order);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', padding: '20px 28px 16px', borderBottom: '1px solid var(--c-border)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.06em', color: 'var(--c-muted)' }}>
            03 · GENERATIONRESULT · result_kind=keyframes
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--c-text)' }}>Keyframe storyboard</h1>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--c-accent)' }}>{kfResult.result_id}</span>
          </div>
        </div>
        <button onClick={handleApproveFrames} style={{ background: 'var(--c-accent)', border: 'none', color: '#17110A', padding: '9px 14px', borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          Approve frames → video plan
        </button>
      </div>

      {/* Scenes */}
      <div style={{ padding: '20px 28px 40px', display: 'flex', flexDirection: 'column', gap: 22 }}>
        {resultScenes.map(rscene => {
          const draft = scenes.find(s => s.id === rscene.scene_id);
          const planScene = plan?.scenes.find(ps => ps.scene_id === rscene.scene_id);
          const summary = draft?.summary || rscene.scene_id;
          const modeLabel = draft?.mode === 'continue_from_previous' ? '↳ first frame inherited' : 'independent';
          const modeColor = draft?.mode === 'continue_from_previous' ? 'var(--c-accent)' : 'var(--c-dim)';

          // Group keyframes by shot_id
          const shotMap = new Map<string, typeof rscene.keyframes>();
          for (const kf of rscene.keyframes) {
            if (!shotMap.has(kf.shot_id)) shotMap.set(kf.shot_id, []);
            shotMap.get(kf.shot_id)!.push(kf);
          }
          const shots = [...shotMap.entries()].sort(([a], [b]) => a.localeCompare(b));

          return (
            <div key={rscene.scene_id} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Scene header */}
              <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', borderBottom: '1px solid var(--c-border)', paddingBottom: 8 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--c-accent)' }}>{pad(rscene.order + 1)}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-text)' }}>{summary}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: modeColor }}>{modeLabel}</span>
              </div>

              {/* Shot cards */}
              <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 4 }}>
                {shots.length === 0 && (
                  <div style={{ color: 'var(--c-muted)', fontSize: 13 }}>No keyframes generated for this scene.</div>
                )}
                {shots.map(([shotId, kframes]) => {
                  const firstKf = kframes.find(k => k.position === 'first');
                  const lastKf = kframes.find(k => k.position === 'last');
                  const framePairs: Array<{ pos: string; kf: typeof firstKf }> = [
                    { pos: 'first', kf: firstKf },
                    { pos: 'last', kf: lastKf },
                  ];

                  return (
                    <div key={shotId} style={{ flex: 'none', width: 460, border: '1px solid var(--c-border)', borderRadius: 6, padding: 10, background: 'var(--c-surface)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 11, marginBottom: 8 }}>
                        <span style={{ color: 'var(--c-text)' }}>{shotId}</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        {framePairs.map(({ pos, kf }) => {
                          const imgUrl = kf?.asset?.uri ? streamUrl(kf.asset.uri) : null;
                          return (
                            <div key={pos} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                              {imgUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={imgUrl}
                                  alt={`${shotId} ${pos} frame`}
                                  style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', borderRadius: 3, border: '1px solid var(--c-border)', display: 'block' }}
                                />
                              ) : (
                                <div style={{ aspectRatio: '16/9', borderRadius: 3, background: 'repeating-linear-gradient(135deg,#161B20 0 8px,#1E242B 8px 16px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: 6, border: '1px solid var(--c-border)' }}>
                                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--c-dim)' }}>{pos}</span>
                                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--c-dim)' }}>{kf ? 'stored' : '—'}</span>
                                </div>
                              )}
                              <div style={{ fontSize: 11.5, color: 'var(--c-muted)' }}>
                                {pos === 'first' ? 'First frame' : 'Last frame'}
                              </div>
                              {kf?.asset?.sha256 && (
                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--c-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {kf.asset.sha256.slice(0, 20)}…
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
