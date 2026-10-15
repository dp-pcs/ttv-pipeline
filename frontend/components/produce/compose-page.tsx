'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useProduceStore, defaultScene, type SceneDraft } from '@/lib/produce-store';
import { SceneListItem } from './scene-list-item';
import { SceneEditor } from './scene-editor';
import {
  buildMultiSceneRequest,
  createPlan,
  getCapabilities,
  ApiV2Error,
  type CapabilitiesResponse,
} from '@/lib/api-v2';
import { useToast } from '@/hooks/use-toast';

const pad = (n: number) => String(n).padStart(2, '0');
const fmtS = (d: number) => (d % 1 ? d.toFixed(1) : String(d)) + 's';
const fmtT = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${pad(m)}:${pad(sec)}`;
};

const DRAFT_SCENES: SceneDraft[] = [
  {
    ...defaultScene(0),
    id: 'sc_01',
    summary: 'Dawn breaks over a working harbor; fog lifts off moored trawlers',
    entry: 'Black water, fog bank, no light',
    exit: 'Sun clears the breakwater, gulls rising',
    notes: 'Weathered blue trawler MARGIT at frame left throughout',
    dur: 8,
    mode: 'independent',
  },
  {
    ...defaultScene(1),
    id: 'sc_02',
    summary: 'The trawler casts off and pulls away from the pier',
    entry: 'Trawler moored, lines taut',
    exit: 'Trawler clear of pier, wake trailing',
    notes: 'Match fog density and sun angle from sc_01 exit',
    dur: 12,
    transition: 'none',
    mode: 'continue_from_previous',
  },
  {
    ...defaultScene(2),
    id: 'sc_03',
    summary: 'Close on a deckhand coiling wet rope on the stern',
    entry: 'Rope slack across the deck',
    exit: 'Rope coiled, hands rest on the rail',
    notes: 'Same yellow oilskin as the wide shot',
    dur: 6,
    mode: 'continue_from_previous',
  },
  {
    ...defaultScene(3),
    id: 'sc_04',
    summary: 'Lighthouse beam sweeps the empty harbor mouth at dusk',
    entry: 'Low violet sky, beam off',
    exit: 'Beam crosses camera, flare',
    notes: 'Ends on the reference frame for the title card',
    dur: 10,
    audio: 'preserve_if_present',
    mode: 'independent',
  },
];

export function ComposePage() {
  const router = useRouter();
  const { toast } = useToast();

  const scenes = useProduceStore(s => s.scenes);
  const selectedSceneIdx = useProduceStore(s => s.selectedSceneIdx);
  const setSelectedSceneIdx = useProduceStore(s => s.setSelectedSceneIdx);
  const setScenes = useProduceStore(s => s.setScenes);
  const addScene = useProduceStore(s => s.addScene);
  const removeScene = useProduceStore(s => s.removeScene);
  const revision = useProduceStore(s => s.revision);
  const projectId = useProduceStore(s => s.projectId);
  const plan = useProduceStore(s => s.plan);
  const setPlan = useProduceStore(s => s.setPlan);

  const [capabilities, setCapabilities] = useState<CapabilitiesResponse | null>(null);
  const [srcOpen, setSrcOpen] = useState(false);
  const [srcPrompt, setSrcPrompt] = useState('');
  const [planning, setPlanning] = useState(false);
  const [lastRequestSha, setLastRequestSha] = useState<string | null>(null);

  useEffect(() => {
    getCapabilities()
      .then(setCapabilities)
      .catch(() => {
        toast({
          variant: 'destructive',
          title: 'Capabilities unavailable',
          description: 'Could not reach GET /v2/capabilities. Provider list will be empty.',
        });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sel = Math.min(selectedSceneIdx, scenes.length - 1);
  const scene = scenes[sel];
  const total = scenes.reduce((a, x) => a + x.dur, 0);

  const handleAddScene = () => {
    addScene();
  };

  const handleRemoveScene = () => {
    removeScene(sel);
  };

  const handleDecompose = () => {
    setScenes(DRAFT_SCENES);
    setSelectedSceneIdx(0);
    setSrcOpen(false);
  };

  const handleRequestPlan = async () => {
    if (scenes.some(s => !s.summary.trim())) {
      toast({
        variant: 'destructive',
        title: 'Incomplete scenes',
        description: 'Every scene needs a summary before requesting a plan.',
      });
      return;
    }
    setPlanning(true);
    try {
      const request = await buildMultiSceneRequest(scenes, {
        projectId,
        revision,
        storyboardRevisionId: `storyboard-${Date.now()}`,
        regeneration: null,
      });
      const newPlan = await createPlan(request);
      setPlan(newPlan);
      setLastRequestSha(request.document_sha256);
      router.push('/plan');
    } catch (err) {
      const message = err instanceof ApiV2Error ? err.message : 'Failed to reach the generation API';
      toast({ variant: 'destructive', title: 'Could not create plan', description: message });
    } finally {
      setPlanning(false);
    }
  };

  const planState = planning
    ? { label: 'Planning…', color: 'var(--c-run)' }
    : !plan
    ? { label: 'No plan yet', color: 'var(--c-dim)' }
    : { label: `Plan ${plan.plan_id} created`, color: 'var(--c-ok)' };

  const sceneJson = scene
    ? JSON.stringify(
        {
          scene_id: scene.id,
          order: sel,
          intent: { summary: scene.summary, entry_state: scene.entry, exit_state: scene.exit, continuity_notes: scene.notes },
          requested_duration_s: scene.dur,
          transition_out: { type: scene.transition, editorial_note: null },
          continuity: { mode: scene.mode },
          delivery: { aspect_ratio: scene.aspect, target_width: scene.w, target_height: scene.h, audio_policy: scene.audio },
          generation_policy: {
            provider_preferences: scene.prefs,
            max_attempts: scene.attempts,
            max_estimated_cost_usd: scene.cap,
            allow_provider_fallback: scene.fallback,
          },
        },
        null,
        2
      )
    : '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: '16px',
          flexWrap: 'wrap',
          padding: '20px 28px 16px',
          borderBottom: '1px solid var(--c-border)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div
            style={{
              fontFamily: 'var(--font-mono, JetBrains Mono, monospace)',
              fontSize: '11px',
              letterSpacing: '.06em',
              color: 'var(--c-muted)',
            }}
          >
            01 · GENERATIONREQUEST
          </div>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--c-text)' }}>
            Compose scenes
          </h1>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={() => setSrcOpen(!srcOpen)}
            style={{
              background: 'transparent',
              border: '1px solid var(--c-border2)',
              color: 'var(--c-text)',
              padding: '8px 12px',
              borderRadius: '4px',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Draft from prompt
          </button>
          <button
            onClick={handleRequestPlan}
            disabled={planning}
            style={{
              background: 'var(--c-accent)',
              border: 'none',
              color: '#17110A',
              padding: '9px 14px',
              borderRadius: '4px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: planning ? 'default' : 'pointer',
              opacity: planning ? 0.7 : 1,
            }}
          >
            {planning ? 'Planning…' : 'Request plan · POST /v2/plans'}
          </button>
        </div>
      </div>

      {/* Draft-from-prompt collapsible */}
      {srcOpen && (
        <div
          style={{
            padding: '16px 28px',
            borderBottom: '1px solid var(--c-border)',
            background: 'var(--c-sidebar)',
            display: 'flex',
            gap: '16px',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ flex: 1, minWidth: '280px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ fontFamily: 'var(--font-mono, JetBrains Mono, monospace)', fontSize: '11px', color: 'var(--c-muted)' }}>
              POST /v1/plans — prompt → segments (editable before any paid call)
            </div>
            <textarea
              value={srcPrompt}
              onChange={e => setSrcPrompt(e.target.value)}
              rows={3}
              placeholder="A weathered trawler leaves a foggy harbor at dawn; a deckhand coils rope; by dusk the lighthouse beam sweeps the empty mouth…"
              style={{
                background: 'var(--c-bg)',
                border: '1px solid var(--c-border2)',
                borderRadius: '4px',
                color: 'var(--c-text)',
                padding: '10px',
                fontSize: '14px',
                resize: 'vertical',
                outline: 'none',
                fontFamily: 'inherit',
              }}
            />
          </div>
          <button
            onClick={handleDecompose}
            style={{
              marginTop: '22px',
              background: 'transparent',
              border: '1px solid var(--c-accent)',
              color: 'var(--c-accent)',
              padding: '8px 12px',
              borderRadius: '4px',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Decompose → scenes
          </button>
        </div>
      )}

      {/* Three panels */}
      <div style={{ display: 'flex', flexWrap: 'wrap', flex: 1, minHeight: 0, alignItems: 'stretch' }}>
        {/* Scene list */}
        <div style={{ flex: '0 0 230px', borderRight: '1px solid var(--c-border)', display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 16px',
              fontFamily: 'var(--font-mono, JetBrains Mono, monospace)',
              fontSize: '11px',
              color: 'var(--c-muted)',
              letterSpacing: '.06em',
            }}
          >
            <span>SCENES · {scenes.length}</span>
            <span>{fmtS(total)}</span>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {scenes.map((s, i) => (
              <SceneListItem
                key={s.id}
                scene={s}
                idx={i}
                isActive={i === sel}
                onClick={() => setSelectedSceneIdx(i)}
              />
            ))}
          </div>
          <div style={{ display: 'flex', gap: '8px', padding: '12px 16px' }}>
            <button
              onClick={handleAddScene}
              style={{
                flex: 1,
                background: 'transparent',
                border: '1px dashed var(--c-border2)',
                color: 'var(--c-muted)',
                padding: '8px',
                borderRadius: '4px',
                fontSize: '12.5px',
                cursor: 'pointer',
              }}
            >
              + Add scene
            </button>
            <button
              onClick={handleRemoveScene}
              disabled={scenes.length < 2}
              style={{
                background: 'transparent',
                border: '1px solid var(--c-border2)',
                color: 'var(--c-muted)',
                padding: '8px 10px',
                borderRadius: '4px',
                fontSize: '12.5px',
                cursor: scenes.length < 2 ? 'not-allowed' : 'pointer',
                opacity: scenes.length < 2 ? 0.4 : 1,
              }}
            >
              Remove
            </button>
          </div>
        </div>

        {/* Scene editor */}
        {scene && <SceneEditor scene={scene} idx={sel} capabilities={capabilities} />}

        {/* Request preview */}
        <div
          style={{
            flex: '1 1 280px',
            borderLeft: '1px solid var(--c-border)',
            borderTop: '1px solid var(--c-border)',
            background: 'var(--c-sidebar)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            minWidth: 0,
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-mono, JetBrains Mono, monospace)',
              fontSize: '11px',
              letterSpacing: '.06em',
              color: 'var(--c-muted)',
            }}
          >
            REQUEST DOCUMENT
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr)', gap: '6px 12px', fontFamily: 'var(--font-mono, JetBrains Mono, monospace)', fontSize: '11.5px' }}>
            <span style={{ color: 'var(--c-dim)' }}>project_id</span>
            <span style={{ color: 'var(--c-text)', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{projectId}</span>
            <span style={{ color: 'var(--c-dim)' }}>revision</span>
            <span style={{ color: 'var(--c-text)', textAlign: 'right' }}>{revision}</span>
            <span style={{ color: 'var(--c-dim)' }}>scenes</span>
            <span style={{ color: 'var(--c-text)', textAlign: 'right' }}>{scenes.length}</span>
            <span style={{ color: 'var(--c-dim)' }}>runtime</span>
            <span style={{ color: 'var(--c-text)', textAlign: 'right' }}>{fmtS(total)} · {fmtT(total)}</span>
            {lastRequestSha && (
              <>
                <span style={{ color: 'var(--c-dim)' }}>document_sha256</span>
                <span style={{ color: 'var(--c-text)', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {lastRequestSha.slice(0, 15)}…
                </span>
              </>
            )}
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 10px',
              border: `1px solid ${planState.color}55`,
              borderRadius: '4px',
              fontSize: '12.5px',
              color: planState.color,
            }}
          >
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: planState.color }} />
            {planState.label}
          </div>
          <div style={{ fontFamily: 'var(--font-mono, JetBrains Mono, monospace)', fontSize: '11px', color: 'var(--c-muted)' }}>
            scene JSON
          </div>
          <pre
            style={{
              margin: 0,
              background: 'var(--c-bg)',
              border: '1px solid var(--c-border)',
              borderRadius: '4px',
              padding: '10px',
              fontFamily: 'var(--font-mono, JetBrains Mono, monospace)',
              fontSize: '10.5px',
              lineHeight: '1.5',
              color: 'var(--c-muted)',
              overflow: 'auto',
              maxHeight: '420px',
              whiteSpace: 'pre',
            }}
          >
            {sceneJson}
          </pre>
        </div>
      </div>
    </div>
  );
}
