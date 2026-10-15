// One-off smoke test for lib/api-v2.ts's canonicalization + plan creation against
// a live dev backend. Not part of the test suite — run manually:
//   node --experimental-global-webcrypto scripts/smoke-test-v2.mjs
// (Node 20+ has crypto.subtle globally; older Node needs the flag above.)

const BASE = process.env.API_BASE_URL || 'http://localhost:8000';

function canonicalize(value) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Non-finite JSON number');
    return value;
  }
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === 'object') {
    const sorted = {};
    for (const key of Object.keys(value).sort()) sorted[key] = canonicalize(value[key]);
    return sorted;
  }
  return value;
}

function canonicalBytes(value) {
  return new TextEncoder().encode(JSON.stringify(canonicalize(value)));
}

async function digest(value) {
  const bytes = canonicalBytes(value);
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
  const hex = Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `sha256:${hex}`;
}

async function seal(doc) {
  const { document_sha256: _drop, ...rest } = doc;
  return { ...rest, document_sha256: await digest(rest) };
}

function newId() {
  return crypto.randomUUID();
}

function nowIso() {
  return new Date().toISOString().replace(/\.\d+Z$/, 'Z');
}

async function main() {
  const caps = await fetch(`${BASE}/v2/capabilities`).then((r) => r.json());
  console.log('capabilities:', JSON.stringify(caps));
  const provider = caps.providers[0]?.provider;
  if (!provider) throw new Error('No providers available from /v2/capabilities');
  const durations = caps.providers[0].capability_snapshot.allowed_durations_s;
  const duration = durations[0];

  const sceneId = 'scene-1';
  const unsealed = {
    contract_version: '1.0',
    created_at: nowIso(),
    document_sha256: '',
    request_id: `genreq-${newId()}`,
    project_id: 'visionweave-web-smoketest',
    revision: 1,
    supersedes_request_id: null,
    idempotency_key: newId(),
    storyboard: { revision_id: `storyboard-${newId()}`, sha256: await digest({ scenes: [sceneId] }) },
    regeneration: null,
    scenes: [
      {
        scene_id: sceneId,
        order: 1,
        intent: { summary: 'A single red circle on a white background', entry_state: '', exit_state: '', continuity_notes: '' },
        requested_duration_s: duration,
        transition_out: { type: 'cut', editorial_note: null },
        continuity: { mode: 'independent', required_reference_asset_ids: [] },
        reference_assets: [],
        delivery: { aspect_ratio: '16:9', target_width: 1280, target_height: 720, audio_policy: 'preserve_if_present' },
        generation_policy: { provider_preferences: [provider], max_attempts: 4, max_estimated_cost_usd: null, allow_provider_fallback: false },
      },
    ],
  };
  const request = await seal(unsealed);
  console.log('sealed request_id:', request.request_id, 'document_sha256:', request.document_sha256);

  const planRes = await fetch(`${BASE}/v2/plans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  const planText = await planRes.text();
  if (!planRes.ok) {
    console.error('PLAN FAILED', planRes.status, planText);
    process.exit(1);
  }
  const plan = JSON.parse(planText);
  console.log('plan status:', plan.status);
  console.log('plan scene[0] variants:', JSON.stringify(plan.scenes[0].variants.map((v) => ({ variant_id: v.variant_id, provider: v.provider, cost: v.estimated_cost }))));
  console.log('plan scene[0] warnings:', plan.scenes[0].warnings);
  console.log('blocked_reasons:', plan.blocked_reasons);

  if (plan.status !== 'ready') {
    console.error('Plan not ready — cannot continue to approval smoke test');
    process.exit(1);
  }

  console.log('\nSMOKE TEST PASSED (plan creation). Not approving/running a real job here to avoid real spend.');
}

main().catch((err) => {
  console.error('SMOKE TEST ERROR', err);
  process.exit(1);
});
