'use client';

import { useState } from 'react';
import { useProduceStore } from '@/lib/produce-store';
import type { SceneDraft } from '@/lib/produce-store';
import type { CapabilitiesResponse } from '@/lib/api-v2';

const pad = (n: number) => String(n).padStart(2, '0');

const SECTION_HEADER: React.CSSProperties = {
  fontFamily: 'var(--font-mono, JetBrains Mono, monospace)',
  fontSize: '11px',
  letterSpacing: '.06em',
  textTransform: 'uppercase',
  color: 'var(--c-muted)',
  borderBottom: '1px solid var(--c-border)',
  paddingBottom: '6px',
};

const INPUT_BASE: React.CSSProperties = {
  background: 'var(--c-bg)',
  border: '1px solid var(--c-border2)',
  borderRadius: '4px',
  color: 'var(--c-text)',
  padding: '8px 10px',
  fontSize: '14px',
  outline: 'none',
  width: '100%',
  fontFamily: 'inherit',
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize: '12px',
  color: 'var(--c-muted)',
  marginBottom: '4px',
  display: 'block',
};

function FocusInput({
  value,
  onChange,
  style,
  type = 'text',
  placeholder,
  min,
  max,
  step,
}: {
  value: string | number;
  onChange: (v: string) => void;
  style?: React.CSSProperties;
  type?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      min={min}
      max={max}
      step={step}
      onChange={e => onChange(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        ...INPUT_BASE,
        borderColor: focused ? 'var(--c-accent)' : 'var(--c-border2)',
        ...style,
      }}
    />
  );
}

function FocusTextarea({
  value,
  onChange,
  rows = 2,
  placeholder,
  style,
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
  style?: React.CSSProperties;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <textarea
      rows={rows}
      value={value}
      placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        ...INPUT_BASE,
        resize: 'vertical',
        borderColor: focused ? 'var(--c-accent)' : 'var(--c-border2)',
        ...style,
      }}
    />
  );
}

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  disabled,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        border: '1px solid var(--c-border2)',
        borderRadius: '4px',
        overflow: 'hidden',
      }}
    >
      {options.map(opt => {
        const active = opt.value === value;
        return (
          <div
            key={opt.value}
            onClick={() => !disabled && onChange(opt.value)}
            style={{
              padding: '7px 12px',
              fontFamily: 'var(--font-mono, JetBrains Mono, monospace)',
              fontSize: '12px',
              background: active ? '#2A313A' : 'transparent',
              color: active ? 'var(--c-text)' : 'var(--c-muted)',
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled && !active ? 0.4 : 1,
            }}
          >
            {opt.label}
          </div>
        );
      })}
    </div>
  );
}

interface SceneEditorProps {
  scene: SceneDraft;
  idx: number;
  capabilities: CapabilitiesResponse | null;
}

export function SceneEditor({ scene, idx, capabilities }: SceneEditorProps) {
  const updateScene = useProduceStore(s => s.updateScene);

  const upd = (patch: Partial<SceneDraft>) => updateScene(idx, patch);

  const dimsMap: Record<string, [number, number]> = {
    '16:9': [1920, 1080],
    '9:16': [1080, 1920],
    '1:1': [1080, 1080],
  };

  const toggleProvider = (providerId: string) => {
    const r = scene.prefs.indexOf(providerId);
    if (r >= 0) {
      upd({ prefs: scene.prefs.filter(p => p !== providerId) });
    } else {
      upd({ prefs: [...scene.prefs, providerId] });
    }
  };

  return (
    <div
      style={{
        flex: 1,
        padding: '20px 24px 40px',
        display: 'flex',
        flexDirection: 'column',
        gap: '22px',
        minWidth: 0,
        overflowY: 'auto',
      }}
    >
      {/* Scene identity */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
        <span
          style={{
            fontFamily: 'var(--font-mono, JetBrains Mono, monospace)',
            fontSize: '12px',
            color: 'var(--c-accent)',
          }}
        >
          {scene.id}
        </span>
        <span
          style={{
            fontFamily: 'var(--font-mono, JetBrains Mono, monospace)',
            fontSize: '11px',
            color: 'var(--c-dim)',
          }}
        >
          order {idx}
        </span>
      </div>

      {/* INTENT */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={SECTION_HEADER}>Intent</div>
        <label>
          <span style={LABEL_STYLE}>summary</span>
          <FocusTextarea
            value={scene.summary}
            onChange={v => upd({ summary: v })}
            rows={2}
            placeholder="Describe what happens in this scene…"
          />
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <label>
            <span style={LABEL_STYLE}>entry_state</span>
            <FocusInput value={scene.entry} onChange={v => upd({ entry: v })} />
          </label>
          <label>
            <span style={LABEL_STYLE}>exit_state</span>
            <FocusInput value={scene.exit} onChange={v => upd({ exit: v })} />
          </label>
        </div>
        <label>
          <span style={LABEL_STYLE}>continuity_notes</span>
          <FocusInput
            value={scene.notes}
            onChange={v => upd({ notes: v })}
            placeholder="Match lighting, costume, props…"
          />
        </label>
      </section>

      {/* TIMING · CONTINUITY */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={SECTION_HEADER}>Timing · Continuity</div>
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', width: '130px' }}>
            <span style={LABEL_STYLE}>requested_duration_s</span>
            <FocusInput
              type="number"
              value={scene.dur}
              onChange={v => upd({ dur: Math.max(1, Math.min(14440, Number(v) || 1)) })}
              style={{ fontFamily: 'var(--font-mono, JetBrains Mono, monospace)' }}
              min={1}
              max={14440}
            />
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <span style={LABEL_STYLE}>transition_out</span>
            <SegmentedControl
              options={[
                { label: 'cut', value: 'cut' },
                { label: 'none', value: 'none' },
              ]}
              value={scene.transition}
              onChange={v => upd({ transition: v as 'cut' | 'none' })}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <span style={LABEL_STYLE}>continuity.mode</span>
            <SegmentedControl
              options={[
                { label: 'independent', value: 'independent' },
                { label: 'continue_from_previous', value: 'continue_from_previous' },
              ]}
              value={scene.mode}
              onChange={v => upd({ mode: v as SceneDraft['mode'] })}
              disabled={idx === 0}
            />
          </div>
        </div>
        {scene.mode === 'continue_from_previous' && idx > 0 && (
          <div style={{ fontSize: '12.5px', color: 'var(--c-muted)' }}>
            First frame comes from the last frame of the previous scene. Shots run in sequence.
          </div>
        )}
        {idx === 0 && (
          <div style={{ fontSize: '12.5px', color: 'var(--c-dim)' }}>
            First scene is always independent — it has no prior scene to continue from.
          </div>
        )}
      </section>

      {/* REFERENCE ASSETS */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={SECTION_HEADER}>Reference Assets</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
          {(['first_frame', 'last_frame'] as const).map(role => (
            <div
              key={role}
              title="Asset upload coming soon"
              style={{
                display: 'flex',
                flexDirection: 'column',
                border: '1px solid var(--c-border2)',
                borderRadius: '4px',
                overflow: 'hidden',
                cursor: 'not-allowed',
                opacity: 0.7,
              }}
            >
              <div
                style={{
                  aspectRatio: '16/9',
                  background: 'var(--c-bg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'var(--font-mono, JetBrains Mono, monospace)',
                  fontSize: '11px',
                  color: 'var(--c-dim)',
                }}
              >
                + attach {role}
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '8px',
                  padding: '7px 9px',
                  fontFamily: 'var(--font-mono, JetBrains Mono, monospace)',
                  fontSize: '11px',
                  borderTop: '1px solid var(--c-border)',
                }}
              >
                <span style={{ color: 'var(--c-text)' }}>{role}</span>
                <span style={{ color: 'var(--c-dim)' }}>coming soon</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* DELIVERY */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={SECTION_HEADER}>Delivery</div>
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <span style={LABEL_STYLE}>aspect_ratio</span>
            <SegmentedControl
              options={[
                { label: '16:9', value: '16:9' },
                { label: '9:16', value: '9:16' },
                { label: '1:1', value: '1:1' },
              ]}
              value={scene.aspect}
              onChange={v => {
                const d = dimsMap[v] || [1920, 1080];
                upd({ aspect: v as SceneDraft['aspect'], w: d[0], h: d[1] });
              }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <span style={LABEL_STYLE}>target</span>
            <span
              style={{
                fontFamily: 'var(--font-mono, JetBrains Mono, monospace)',
                fontSize: '13px',
                padding: '7px 0',
                color: 'var(--c-text)',
              }}
            >
              {scene.w} × {scene.h}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <span style={LABEL_STYLE}>audio_policy</span>
            <SegmentedControl
              options={[
                { label: 'preserve', value: 'preserve_if_present' },
                { label: 'mute', value: 'mute' },
                { label: 'required', value: 'required' },
              ]}
              value={scene.audio}
              onChange={v => upd({ audio: v as SceneDraft['audio'] })}
            />
          </div>
        </div>
      </section>

      {/* GENERATION POLICY */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={SECTION_HEADER}>Generation Policy</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <span style={LABEL_STYLE}>provider_preferences — click to add/remove, order = priority</span>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {(capabilities?.providers ?? []).map(p => {
              const rank = scene.prefs.indexOf(p.provider);
              const selected = rank >= 0;
              return (
                <div
                  key={p.provider}
                  onClick={() => toggleProvider(p.provider)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 10px',
                    border: `1px solid ${selected ? 'var(--c-muted)' : 'var(--c-border)'}`,
                    borderRadius: '4px',
                    cursor: 'pointer',
                    color: selected ? 'var(--c-text)' : 'var(--c-muted)',
                    fontSize: '13px',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-mono, JetBrains Mono, monospace)',
                      fontSize: '11px',
                      color: selected ? 'var(--c-accent)' : 'var(--c-dim)',
                    }}
                  >
                    {selected ? rank + 1 : '·'}
                  </span>
                  {p.provider}
                </div>
              );
            })}
            {!capabilities && (
              <span style={{ fontSize: '12px', color: 'var(--c-dim)' }}>Loading providers…</span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', width: '110px' }}>
            <span style={LABEL_STYLE}>max_attempts</span>
            <FocusInput
              type="number"
              value={scene.attempts}
              onChange={v => upd({ attempts: Math.max(1, Math.min(100, Number(v) || 1)) })}
              style={{ fontFamily: 'var(--font-mono, JetBrains Mono, monospace)' }}
              min={1}
              max={100}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', width: '180px' }}>
            <span style={LABEL_STYLE}>max_estimated_cost_usd</span>
            <FocusInput
              type="number"
              value={scene.cap ?? ''}
              onChange={v => upd({ cap: v === '' ? null : Number(v) })}
              style={{ fontFamily: 'var(--font-mono, JetBrains Mono, monospace)' }}
              min={0}
              step={0.01}
              placeholder="unlimited"
            />
          </label>
          <div
            onClick={() => upd({ fallback: !scene.fallback })}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              cursor: 'pointer',
              padding: '8px 0',
            }}
          >
            <div
              style={{
                position: 'relative',
                width: '34px',
                height: '18px',
                borderRadius: '9px',
                background: scene.fallback ? 'var(--c-accent)' : 'var(--c-border2)',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: '2px',
                  left: scene.fallback ? '18px' : '2px',
                  width: '14px',
                  height: '14px',
                  borderRadius: '50%',
                  background: 'var(--c-text)',
                  transition: 'left 0.15s',
                }}
              />
            </div>
            <span
              style={{
                fontFamily: 'var(--font-mono, JetBrains Mono, monospace)',
                fontSize: '12px',
                color: 'var(--c-text)',
              }}
            >
              allow_provider_fallback
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
