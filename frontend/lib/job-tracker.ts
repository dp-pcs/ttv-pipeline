// v2 has no bare GET /v2/jobs list endpoint (only GET /v2/jobs/{id}) — this app is
// a single-browser client, not a multi-user dashboard, so we track "my" job ids
// locally instead of asking the server to list them. We also cache title/prompt
// here since GenerationJob documents don't carry them (those live on the
// GenerationRequest, fetched separately) — purely for display, never resent.

const STORAGE_KEY = 'visionweave_tracked_jobs';
const MAX_TRACKED_JOBS = 50;

export interface TrackedJob {
  id: string;
  title?: string;
  prompt?: string;
  createdAt: string;
}

function readAll(): TrackedJob[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is TrackedJob => entry && typeof entry.id === 'string')
      : [];
  } catch {
    return [];
  }
}

function writeAll(jobs: TrackedJob[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
  } catch {
    // ignore storage failures (private browsing, quota, etc.)
  }
}

export function getTrackedJobs(): TrackedJob[] {
  return readAll();
}

export function getTrackedJobIds(): string[] {
  return readAll().map((job) => job.id);
}

export function getTrackedJobMeta(jobId: string): TrackedJob | undefined {
  return readAll().find((job) => job.id === jobId);
}

export function addTrackedJob(jobId: string, meta: { title?: string; prompt?: string } = {}): void {
  const jobs = readAll();
  if (jobs.some((job) => job.id === jobId)) return;
  const entry: TrackedJob = { id: jobId, title: meta.title, prompt: meta.prompt, createdAt: new Date().toISOString() };
  // newest first, capped so this doesn't grow unbounded over a long browser session
  writeAll([entry, ...jobs].slice(0, MAX_TRACKED_JOBS));
}

export function removeTrackedJob(jobId: string): void {
  writeAll(readAll().filter((job) => job.id !== jobId));
}
