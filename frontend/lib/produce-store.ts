'use client';

import { create } from 'zustand';
import type {
  CapabilitiesResponse,
  GenerationPlan,
  JobDocument,
  GenerationResult,
} from './api-v2';

export interface SceneDraft {
  id: string;
  summary: string;
  entry: string;
  exit: string;
  notes: string;
  dur: number;
  transition: 'cut' | 'none';
  mode: 'independent' | 'continue_from_previous';
  aspect: '16:9' | '9:16' | '1:1';
  w: number;
  h: number;
  audio: 'preserve_if_present' | 'mute' | 'required';
  prefs: string[];
  attempts: number;
  cap: number | null;
  fallback: boolean;
  refs: Array<{ role: 'first_frame' | 'last_frame'; name: string }>;
}

export function defaultScene(idx: number): SceneDraft {
  const id = `sc_${String(idx + 1).padStart(2, '0')}`;
  return {
    id,
    summary: '',
    entry: '',
    exit: '',
    notes: '',
    dur: 6,
    transition: 'cut',
    mode: idx === 0 ? 'independent' : 'continue_from_previous',
    aspect: '16:9',
    w: 1920,
    h: 1080,
    audio: 'mute',
    prefs: [],
    attempts: 3,
    cap: null,
    fallback: true,
    refs: [],
  };
}

interface ProduceStore {
  // Compose
  scenes: SceneDraft[];
  selectedSceneIdx: number;
  srcPrompt: string;
  revision: number;
  projectId: string;

  // Plan
  capabilities: CapabilitiesResponse | null;
  plan: GenerationPlan | null;
  chosenVariants: Record<string, string>; // scene_id → variant_id
  executionMode: 'video' | 'keyframes';
  budget: string;
  allowUnknownCost: boolean;

  // Storyboard (keyframes result)
  kfResult: GenerationResult | null;
  useKfResult: boolean; // whether to pass approved_keyframe_result_id on next video approval

  // Run
  activeJob: JobDocument | null;

  // Result
  videoResult: GenerationResult | null;
  resSel: number; // selected scene index in result view
  regenSel: Record<string, boolean>; // scene_id → selected for regen

  // Regenerate
  regenReason: string;
  continuityDecisions: Record<string, 'accept_stale' | 'use_boundary' | 'regenerate'>;

  // Settings / connection
  baseUrl: string;
  authToken: string;

  // Actions
  setScenes: (scenes: SceneDraft[]) => void;
  updateScene: (idx: number, patch: Partial<SceneDraft>) => void;
  setSelectedSceneIdx: (idx: number) => void;
  addScene: () => void;
  removeScene: (idx: number) => void;
  setSrcPrompt: (prompt: string) => void;
  setCapabilities: (caps: CapabilitiesResponse) => void;
  setPlan: (plan: GenerationPlan) => void;
  clearPlan: () => void;
  setChosenVariant: (sceneId: string, variantId: string) => void;
  setExecutionMode: (mode: 'video' | 'keyframes') => void;
  setBudget: (budget: string) => void;
  setAllowUnknownCost: (v: boolean) => void;
  setKfResult: (result: GenerationResult | null) => void;
  setUseKfResult: (v: boolean) => void;
  setActiveJob: (job: JobDocument | null) => void;
  updateActiveJob: (patch: Partial<JobDocument>) => void;
  setVideoResult: (result: GenerationResult | null) => void;
  setResSel: (idx: number) => void;
  toggleRegenSel: (sceneId: string) => void;
  setRegenSel: (sel: Record<string, boolean>) => void;
  setRegenReason: (reason: string) => void;
  setContinuityDecision: (sceneId: string, decision: 'accept_stale' | 'use_boundary' | 'regenerate') => void;
  setBaseUrl: (url: string) => void;
  setAuthToken: (token: string) => void;
  incrementRevision: () => void;
  resetProduce: () => void;
}

function loadBaseUrl(): string {
  if (typeof window === 'undefined') return 'http://localhost:8000';
  try {
    const s = localStorage.getItem('visionweave_settings');
    if (s) return JSON.parse(s).api_base_url || 'http://localhost:8000';
  } catch {}
  return 'http://localhost:8000';
}

function loadAuthToken(): string {
  if (typeof window === 'undefined') return '';
  try {
    const s = localStorage.getItem('visionweave_settings');
    if (s) return JSON.parse(s).auth_token || '';
  } catch {}
  return '';
}

const initialScenes: SceneDraft[] = [defaultScene(0)];

export const useProduceStore = create<ProduceStore>((set) => ({
  scenes: initialScenes,
  selectedSceneIdx: 0,
  srcPrompt: '',
  revision: 1,
  projectId: 'continuity-project',

  capabilities: null,
  plan: null,
  chosenVariants: {},
  executionMode: 'video',
  budget: '20',
  allowUnknownCost: false,

  kfResult: null,
  useKfResult: false,

  activeJob: null,

  videoResult: null,
  resSel: 0,
  regenSel: {},

  regenReason: '',
  continuityDecisions: {},

  baseUrl: loadBaseUrl(),
  authToken: loadAuthToken(),

  setScenes: (scenes) => set({ scenes }),
  updateScene: (idx, patch) =>
    set((s) => {
      const scenes = s.scenes.slice();
      scenes[idx] = { ...scenes[idx], ...patch };
      return { scenes };
    }),
  setSelectedSceneIdx: (idx) => set({ selectedSceneIdx: idx }),
  addScene: () =>
    set((s) => {
      const next = defaultScene(s.scenes.length);
      return { scenes: [...s.scenes, next] };
    }),
  removeScene: (idx) =>
    set((s) => {
      if (s.scenes.length <= 1) return {};
      const scenes = s.scenes.filter((_, i) => i !== idx);
      return {
        scenes,
        selectedSceneIdx: Math.max(0, Math.min(idx, scenes.length - 1)),
      };
    }),
  setSrcPrompt: (srcPrompt) => set({ srcPrompt }),
  setCapabilities: (capabilities) => set({ capabilities }),
  setPlan: (plan) => set({ plan, chosenVariants: {} }),
  clearPlan: () => set({ plan: null, chosenVariants: {} }),
  setChosenVariant: (sceneId, variantId) =>
    set((s) => ({ chosenVariants: { ...s.chosenVariants, [sceneId]: variantId } })),
  setExecutionMode: (executionMode) => set({ executionMode }),
  setBudget: (budget) => set({ budget }),
  setAllowUnknownCost: (allowUnknownCost) => set({ allowUnknownCost }),
  setKfResult: (kfResult) => set({ kfResult }),
  setUseKfResult: (useKfResult) => set({ useKfResult }),
  setActiveJob: (activeJob) => set({ activeJob }),
  updateActiveJob: (patch) =>
    set((s) => ({ activeJob: s.activeJob ? { ...s.activeJob, ...patch } : null })),
  setVideoResult: (videoResult) => set({ videoResult }),
  setResSel: (resSel) => set({ resSel }),
  toggleRegenSel: (sceneId) =>
    set((s) => ({ regenSel: { ...s.regenSel, [sceneId]: !s.regenSel[sceneId] } })),
  setRegenSel: (regenSel) => set({ regenSel }),
  setRegenReason: (regenReason) => set({ regenReason }),
  setContinuityDecision: (sceneId, decision) =>
    set((s) => ({ continuityDecisions: { ...s.continuityDecisions, [sceneId]: decision } })),
  setBaseUrl: (baseUrl) => set({ baseUrl }),
  setAuthToken: (authToken) => set({ authToken }),
  incrementRevision: () => set((s) => ({ revision: s.revision + 1 })),
  resetProduce: () =>
    set({
      plan: null,
      chosenVariants: {},
      kfResult: null,
      useKfResult: false,
      activeJob: null,
      videoResult: null,
      resSel: 0,
      regenSel: {},
      regenReason: '',
      continuityDecisions: {},
    }),
}));
