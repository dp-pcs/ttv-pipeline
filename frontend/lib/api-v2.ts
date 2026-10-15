'use client';

import { api } from './api';

// ============================================================================
// Canonical JSON + SHA-256, mirroring api/contracts/generation_v1.py exactly:
// canonical_bytes() (sorted keys, compact separators, raw UTF-8, no NaN/Infinity)
// and digest()/seal(). The backend validates document_sha256 by recomputing this
// same hash server-side and rejecting on mismatch (422) — these must stay in sync
// with the Python implementation if that ever changes.
// ============================================================================

function canonicalize(value: unknown): unknown {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error('Non-finite JSON number in document');
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value !== null && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) {
      sorted[key] = canonicalize(source[key]);
    }
    return sorted;
  }
  return value;
}

function canonicalBytes(value: unknown): Uint8Array {
  const json = JSON.stringify(canonicalize(value));
  return new TextEncoder().encode(json);
}

async function digest(value: unknown): Promise<string> {
  const bytes = canonicalBytes(value);
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  const hex = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `sha256:${hex}`;
}

/** Strips document_sha256, recomputes it over everything else, and re-attaches it. */
async function seal<T extends Record<string, unknown>>(
  document: T
): Promise<T & { document_sha256: string }> {
  const { document_sha256: _drop, ...rest } = document as Record<string, unknown>;
  const hash = await digest(rest);
  return { ...(rest as T), document_sha256: hash };
}

function newId(): string {
  return crypto.randomUUID();
}

function nowIso(): string {
  return new Date().toISOString().replace(/\.\d+Z$/, 'Z');
}

// ============================================================================
// Types (trimmed to what the single-prompt UI needs; fields match
// api/contracts/v1_0/*.schema.json — these are Strict/additionalProperties:false
// schemas, so every field must be present, nulls explicit, no extras.)
// ============================================================================

export interface AssetRef {
  asset_id: string;
  uri: string;
  sha256: string;
  mime_type: string;
  role: string;
  rights_note: string | null;
  media?: unknown;
  source_take_id?: string | null;
}

export interface GenerationRequestScene {
  scene_id: string;
  order: number;
  intent: {
    summary: string;
    entry_state: string;
    exit_state: string;
    continuity_notes: string;
  };
  requested_duration_s: number;
  transition_out: { type: 'cut' | 'none'; editorial_note: string | null };
  continuity: { mode: 'independent' | 'continue_from_previous'; required_reference_asset_ids: string[] };
  reference_assets: AssetRef[];
  delivery: {
    aspect_ratio: string;
    target_width: number;
    target_height: number;
    audio_policy: 'preserve_if_present' | 'mute' | 'required';
  };
  generation_policy: {
    provider_preferences: string[];
    max_attempts: number;
    max_estimated_cost_usd: number | null;
    allow_provider_fallback: boolean;
  };
}

export interface GenerationRequest {
  contract_version: '1.0';
  created_at: string;
  document_sha256: string;
  request_id: string;
  project_id: string;
  revision: number;
  supersedes_request_id: string | null;
  idempotency_key: string;
  storyboard: { revision_id: string; sha256: string };
  scenes: GenerationRequestScene[];
  regeneration: { base_result_ids: string[]; supersedes_take_ids: string[]; reason: string } | null;
}

export interface CapabilitySnapshot {
  allowed_durations_s: number[];
  supports_first_frame: boolean;
  supports_last_frame: boolean;
  supports_audio: boolean;
}

export interface Variant {
  variant_id: string;
  provider: string;
  model: string;
  capability_snapshot: CapabilitySnapshot;
  shots: unknown[];
  estimated_cost: { amount: number | null; currency: 'USD'; basis: string };
}

export interface GenerationPlan {
  contract_version: '1.0';
  created_at: string;
  document_sha256: string;
  plan_id: string;
  request_id: string;
  valid_until: string;
  status: 'ready' | 'blocked';
  scenes: Array<{
    scene_id: string;
    order: number;
    requested_duration_s: number;
    variants: Variant[];
    warnings: string[];
  }>;
  blocked_reasons: Array<{ scene_id: string | null; code: string; message: string }>;
}

export interface PlanApproval {
  contract_version: '1.0';
  created_at: string;
  document_sha256: string;
  approval_id: string;
  request_id: string;
  plan_id: string;
  plan_sha256: string;
  execution_mode: 'video' | 'keyframes';
  approved_variant_ids: string[];
  approved_keyframe_result_id: string | null;
  idempotency_key: string;
  allow_unknown_cost: boolean;
  max_estimated_cost_usd: number | null;
}

export interface JobDocument {
  id: string;
  status: string;
  progress?: number;
  created_at: string;
  started_at?: string | null;
  finished_at?: string | null;
  request_id: string;
  plan_id: string;
  approval_id: string;
  current_scene_id?: string | null;
  current_shot_id?: string | null;
  warnings: string[];
  cancel_requested: boolean;
  result_id: string | null;
  result_uri: string | null;
  result_sha256: string | null;
}

export interface GenerationResult {
  contract_version: '1.0';
  result_id: string;
  result_kind: string;
  request_id: string;
  plan_id: string;
  approval_id: string;
  job_id: string;
  terminal_status: 'succeeded' | 'partial' | 'failed' | 'canceled';
  reference_assets: AssetRef[];
  preview_assets: AssetRef[];
  scenes: Array<{
    scene_id: string;
    order: number;
    status: string;
    clips: Array<{ clip_id: string; attempt_id: string; asset: AssetRef; media: unknown }>;
    keyframes: Array<{ shot_id: string; order: number; position: string; attempt_id: string; asset: AssetRef; media: unknown }>;
    takes: Array<{
      take_id: string;
      clip_ids: string[];
      clip_order: string[];
      preview_asset_id: string;
      supersedes_take_ids: string[];
      depends_on_take_ids: string[];
      nominal_duration_s: number;
      measured_duration_s: number;
    }>;
    warnings: string[];
  }>;
}

export interface ProviderCapability {
  provider: string;
  model: string;
  capability_snapshot: CapabilitySnapshot;
}

export interface CapabilitiesResponse {
  contract_version: '1.0';
  providers: ProviderCapability[];
  // Sibling of `providers`, not part of the strict Variant/Capability contract —
  // see the comment in api/generation_service.py's capabilities() for why this
  // can't live inside a providers[] entry.
  provider_options: Record<string, { supported_resolutions?: string[]; supported_aspect_ratios?: string[] }>;
}

// ============================================================================
// HTTP layer
// ============================================================================

export class ApiV2Error extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiV2Error';
  }
}

async function requestV2<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${api.getBaseUrl()}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers as Record<string, string> || {}) },
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new ApiV2Error(response.status, text || `v2 API error ${response.status}`);
  }
  return response.json();
}

export async function getCapabilities(): Promise<CapabilitiesResponse> {
  return requestV2('/v2/capabilities');
}

export interface SingleSceneOptions {
  provider: string;
  durationSeconds: number;
  aspectRatio: string;
  targetWidth: number;
  targetHeight: number;
}

/**
 * Builds a full, schema-valid single-scene GenerationRequest from just a prompt,
 * keeping today's "one text box" UX while using the v2 contract underneath.
 * reference_assets stays empty — this deployment has image_generation_model
 * configured, so the server fills in the first frame itself (verified against
 * api/generation_service.py's plan() + tests/test_generation_integration.py).
 */
export async function buildSingleSceneRequest(
  prompt: string,
  opts: SingleSceneOptions
): Promise<GenerationRequest> {
  const sceneId = 'scene-1';
  const unsealed: Omit<GenerationRequest, 'document_sha256'> & { document_sha256: string } = {
    contract_version: '1.0',
    created_at: nowIso(),
    document_sha256: '',
    request_id: `genreq-${newId()}`,
    project_id: 'visionweave-web',
    revision: 1,
    supersedes_request_id: null,
    idempotency_key: newId(),
    storyboard: { revision_id: `storyboard-${newId()}`, sha256: await digest({ scenes: [sceneId] }) },
    regeneration: null,
    scenes: [
      {
        scene_id: sceneId,
        order: 1,
        intent: { summary: prompt, entry_state: '', exit_state: '', continuity_notes: '' },
        requested_duration_s: opts.durationSeconds,
        transition_out: { type: 'cut', editorial_note: null },
        continuity: { mode: 'independent', required_reference_asset_ids: [] },
        reference_assets: [],
        delivery: {
          aspect_ratio: opts.aspectRatio,
          target_width: opts.targetWidth,
          target_height: opts.targetHeight,
          audio_policy: 'preserve_if_present',
        },
        generation_policy: {
          provider_preferences: [opts.provider],
          max_attempts: 4,
          max_estimated_cost_usd: null,
          allow_provider_fallback: false,
        },
      },
    ],
  };
  return seal(unsealed);
}

export async function createPlan(request: GenerationRequest): Promise<GenerationPlan> {
  return requestV2('/v2/plans', { method: 'POST', body: JSON.stringify(request) });
}

/**
 * Copies plan_sha256 forward from plan.document_sha256 — never recomputed, per the contract.
 *
 * `allowUnknownCost` must be true to approve a plan carrying an "unavailable cost
 * estimate" warning (POST /v2/jobs 422s otherwise). This deployment's keyframe
 * image model (Gemini) has no tracked per-call price, so plan().scenes[].warnings
 * will contain "image cost estimate unavailable" on essentially every real job —
 * the UI should surface that warning and let the user explicitly accept it
 * (default to false here; don't silently default to true).
 */
export async function buildApproval(
  plan: GenerationPlan,
  approvedVariantIds: string[],
  executionMode: 'video' | 'keyframes',
  allowUnknownCost: boolean = false
): Promise<PlanApproval> {
  const unsealed = {
    contract_version: '1.0' as const,
    created_at: nowIso(),
    document_sha256: '',
    approval_id: `approval-${newId()}`,
    request_id: plan.request_id,
    plan_id: plan.plan_id,
    plan_sha256: plan.document_sha256,
    execution_mode: executionMode,
    approved_variant_ids: approvedVariantIds,
    approved_keyframe_result_id: null,
    idempotency_key: newId(),
    allow_unknown_cost: allowUnknownCost,
    max_estimated_cost_usd: null,
  };
  return seal(unsealed);
}

export async function approvePlan(approval: PlanApproval): Promise<JobDocument> {
  return requestV2('/v2/jobs', { method: 'POST', body: JSON.stringify(approval) });
}

export async function getJob(jobId: string): Promise<JobDocument> {
  return requestV2(`/v2/jobs/${jobId}`);
}

export async function getJobResult(jobId: string): Promise<GenerationResult> {
  return requestV2(`/v2/jobs/${jobId}/result`);
}

export async function cancelJob(jobId: string): Promise<JobDocument> {
  return requestV2(`/v2/jobs/${jobId}/cancel`, { method: 'POST' });
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/**
 * Turns one entry from provider_options[provider] into a scene's delivery block.
 * veo3's options are aspect-ratio labels only (its plan() code requires exactly
 * "16:9"/"9:16" and doesn't otherwise constrain pixel size); runway/minimax's
 * options are literal pixel dimensions (":"- or "x"-separated) with no required
 * aspect_ratio string format, so we derive a display ratio via GCD for those.
 */
export function resolveDelivery(
  provider: string,
  option: string
): { aspectRatio: string; targetWidth: number; targetHeight: number } {
  if (provider === 'veo3') {
    const dims: Record<string, [number, number]> = { '16:9': [1280, 720], '9:16': [720, 1280] };
    const [w, h] = dims[option] || [1280, 720];
    return { aspectRatio: option, targetWidth: w, targetHeight: h };
  }
  const sep = option.includes(':') ? ':' : 'x';
  const [wStr, hStr] = option.split(sep);
  const w = parseInt(wStr, 10);
  const h = parseInt(hStr, 10);
  const divisor = gcd(w, h) || 1;
  return { aspectRatio: `${w / divisor}:${h / divisor}`, targetWidth: w, targetHeight: h };
}

/** The resolution/aspect-ratio option list to show for a provider, or [] to hide the control. */
export function getDeliveryOptions(caps: CapabilitiesResponse, provider: string): string[] {
  const opts = caps.provider_options[provider];
  return opts?.supported_resolutions ?? opts?.supported_aspect_ratios ?? [];
}

/** True when a plan carries a scene warning that requires allow_unknown_cost=true to approve. */
export function planNeedsUnknownCostAck(plan: GenerationPlan): boolean {
  return plan.scenes.some((scene) =>
    scene.warnings.some((w) => w.toLowerCase().includes('cost') && w.toLowerCase().includes('unavailable'))
  );
}

/**
 * Result/reference asset URIs are raw gs://bucket/path URIs (see
 * api/gcs_client.py upload_artifact's docstring) — not directly fetchable from
 * a browser. Strip the gs://<bucket>/ prefix so the existing unversioned
 * /storage/stream and /storage/download routes (api/routes/storage.py, already
 * used by the Storage page) can resolve a signed URL for it.
 */
export function gcsUriToStoragePath(uri: string): string | null {
  const match = /^gs:\/\/[^/]+\/(.+)$/.exec(uri);
  return match ? match[1] : null;
}
