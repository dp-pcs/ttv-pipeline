
'use client';

import { useState, useEffect, Fragment } from 'react';
import { AppSettings, ApiStatus } from '@/lib/types';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useProduceStore } from '@/lib/produce-store';

const DEFAULT_SETTINGS: AppSettings = {
  openai_api_key: '',
  google_project_id: '',
  budget_cap: 10.0,
  api_base_url: 'http://localhost:8000',
};

const SCHEMAS = ['GenerationRequest', 'GenerationPlan', 'PlanApproval', 'GenerationResult', 'EditorialSelection'];

const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono, JetBrains Mono, monospace)' };
const SECTION_HDR: React.CSSProperties = {
  ...MONO, fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase',
  color: 'var(--c-muted)', borderBottom: '1px solid var(--c-border)', paddingBottom: 6,
};
const INPUT_STYLE: React.CSSProperties = {
  background: 'var(--c-bg)', border: '1px solid var(--c-border2)', borderRadius: 4,
  color: 'var(--c-text)', padding: '8px 10px', fontSize: 13, outline: 'none', width: '100%',
};
const LABEL_STYLE: React.CSSProperties = { fontSize: 12, color: 'var(--c-muted)', display: 'block', marginBottom: 5 };

function hashLike(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (Math.imul(31, h) + name.charCodeAt(i)) | 0;
  return 'sha256:' + (h >>> 0).toString(16).padStart(8, '0') + '…';
}

export function Settings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [apiStatus, setApiStatus] = useState<ApiStatus | null>(null);
  const { toast } = useToast();
  const capabilities = useProduceStore(s => s.capabilities);

  useEffect(() => {
    loadSettings();
    testConnection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSettings = () => {
    try {
      const savedSettings = localStorage.getItem('visionweave_settings');
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = () => {
    setIsSaving(true);
    try {
      localStorage.setItem('visionweave_settings', JSON.stringify(settings));
      if (settings.api_base_url) {
        api.setBaseUrl(settings.api_base_url);
      }
      toast({
        variant: 'default',
        title: 'Settings Saved',
        description: 'Your preferences have been saved successfully',
      });
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast({
        variant: 'destructive',
        title: 'Save Failed',
        description: 'Unable to save settings',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const testConnection = async () => {
    setIsTesting(true);
    try {
      const status = await api.getReadinessStatus();
      setApiStatus(status);
      const allHealthy = Object.values(status).every(Boolean);
      toast({
        variant: allHealthy ? 'default' : 'warning',
        title: allHealthy ? 'Connection Successful' : 'Partial Connection',
        description: allHealthy ? 'All services are operational' : 'Some services may be unavailable',
      });
    } catch (error) {
      console.error('Connection test failed:', error);
      setApiStatus({ api: false, worker: false, redis: false, gcs: false });
      toast({
        variant: 'destructive',
        title: 'Connection Failed',
        description: 'Unable to reach the API',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSettingChange = (key: keyof AppSettings, value: string | number) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  if (isLoading) {
    return (
      <div style={{ padding: '40px 28px', ...MONO, fontSize: 13, color: 'var(--c-dim)' }}>
        Loading settings…
      </div>
    );
  }

  const allHealthy = apiStatus ? Object.values(apiStatus).every(Boolean) : null;
  const connLabel = isTesting ? 'Testing…' : allHealthy === null ? 'Not tested' : allHealthy ? 'readyz ok' : 'degraded';
  const connColor = isTesting ? 'var(--c-dim)' : allHealthy === null ? 'var(--c-dim)' : allHealthy ? 'var(--c-ok)' : 'var(--c-fail)';

  const serverCfg: [string, string][] = [
    ['budget_cap_usd', settings.budget_cap.toFixed(2)],
    ['google_project_id', settings.google_project_id || '—'],
    ['openai_key_set', settings.openai_api_key ? 'yes' : 'no'],
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', padding: '20px 28px 16px', borderBottom: '1px solid var(--c-border)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ ...MONO, fontSize: 11, letterSpacing: '.06em', color: 'var(--c-muted)' }}>11 · CONNECTION · AUTH · CAPABILITIES</div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--c-text)' }}>Settings</h1>
        </div>
        <button
          onClick={saveSettings}
          disabled={isSaving}
          style={{
            background: 'var(--c-accent)', border: 'none', color: '#17110A', padding: '9px 14px',
            borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: isSaving ? 'default' : 'pointer', opacity: isSaving ? 0.7 : 1,
          }}
        >
          {isSaving ? 'Saving…' : 'Save settings'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))' }}>
        {/* LEFT: Connection + Server config */}
        <div style={{ padding: '20px 28px 32px', borderRight: '1px solid var(--c-border)', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={SECTION_HDR}>Connection</div>

          <label>
            <span style={LABEL_STYLE}>API base URL</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={settings.api_base_url}
                onChange={e => handleSettingChange('api_base_url', e.target.value)}
                placeholder="http://localhost:8000"
                style={{ ...INPUT_STYLE, ...MONO, flex: 1, minWidth: 0 }}
              />
              <button
                onClick={testConnection}
                disabled={isTesting}
                style={{
                  background: 'transparent', border: '1px solid var(--c-border2)', color: 'var(--c-text)',
                  padding: '8px 12px', borderRadius: 4, fontSize: 12.5, cursor: 'pointer', flexShrink: 0,
                }}
              >
                {connLabel}
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, ...MONO, fontSize: 11, color: connColor }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: connColor }} />
              {connLabel}
            </div>
          </label>

          <label>
            <span style={LABEL_STYLE}>AUTH_TOKEN (Bearer). Protects v1/v2 plans, jobs, results and cancel</span>
            <input
              type="password"
              value={settings.openai_api_key}
              onChange={e => handleSettingChange('openai_api_key', e.target.value)}
              placeholder="sk-…"
              style={{ ...INPUT_STYLE, ...MONO }}
            />
          </label>

          <div style={{ fontSize: 12.5, color: 'var(--c-muted)', lineHeight: 1.5 }}>
            Capability and schema discovery stay public. Provider choice, API keys and fallback
            order live in <span style={{ ...MONO, color: 'var(--c-text)' }}>pipeline_config.yaml</span> on
            the server. They&apos;re frozen into each plan, so this UI reads them but doesn&apos;t set them.
          </div>

          <div style={{ ...SECTION_HDR, marginTop: 6 }}>Server config (read-only)</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr)', gap: '7px 16px', ...MONO, fontSize: 12 }}>
            {serverCfg.map(([k, v]) => (
              <Fragment key={k}>
                <span style={{ color: 'var(--c-dim)' }}>{k}</span>
                <span style={{ textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v}</span>
              </Fragment>
            ))}
          </div>
        </div>

        {/* RIGHT: Capabilities + Schemas */}
        <div style={{ padding: '20px 28px 32px', display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>
          <div style={SECTION_HDR}>GET /v2/capabilities</div>
          {capabilities ? (
            <div style={{ overflowX: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '90px minmax(170px,1fr) 110px 34px 34px 40px 70px', minWidth: 560, ...MONO, fontSize: 10, letterSpacing: '.05em', color: 'var(--c-dim)', paddingBottom: 6 }}>
                <span>PROVIDER</span><span>MODEL</span><span>DURATIONS</span><span>FF</span><span>LF</span><span>AUD</span><span style={{ textAlign: 'right' }}>STATE</span>
              </div>
              {capabilities.providers.map(p => (
                <div key={p.provider} style={{ display: 'grid', gridTemplateColumns: '90px minmax(170px,1fr) 110px 34px 34px 40px 70px', minWidth: 560, ...MONO, fontSize: 11.5, padding: '7px 0', borderTop: '1px solid #1A1F25' }}>
                  <span>{p.provider}</span>
                  <span style={{ color: 'var(--c-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.model}</span>
                  <span>{p.capability_snapshot.allowed_durations_s.join(',')}</span>
                  <span style={{ color: p.capability_snapshot.supports_first_frame ? 'var(--c-text)' : '#3A434E' }}>{p.capability_snapshot.supports_first_frame ? '●' : '○'}</span>
                  <span style={{ color: p.capability_snapshot.supports_last_frame ? 'var(--c-text)' : '#3A434E' }}>{p.capability_snapshot.supports_last_frame ? '●' : '○'}</span>
                  <span style={{ color: p.capability_snapshot.supports_audio ? 'var(--c-text)' : '#3A434E' }}>{p.capability_snapshot.supports_audio ? '●' : '○'}</span>
                  <span style={{ textAlign: 'right', color: 'var(--c-ok)' }}>ready</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 12.5, color: 'var(--c-dim)' }}>Capabilities not yet loaded. Go to Compose to fetch them.</div>
          )}

          <div style={{ ...SECTION_HDR, marginTop: 6 }}>GET /v2/schemas/{'{name}'} · contract 1.0</div>
          {SCHEMAS.map(s => (
            <div key={s} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, ...MONO, fontSize: 11.5 }}>
              <span>{s}.schema.json</span>
              <span style={{ color: 'var(--c-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{hashLike(s)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
