
'use client';

import { JobStatus, JobDetails, JobEstimate, TranscriptionResult, ApiStatus } from './types';

class VisionWeaveAPI {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    // Priority: 1. Constructor param, 2. Environment variable, 3. Default
    this.baseUrl = baseUrl ||
                   (typeof window !== 'undefined' ? window.localStorage.getItem('visionweave_api_url') : null) ||
                   process.env.NEXT_PUBLIC_API_URL ||
                   'http://localhost:8000';
  }

  // Allow updating base URL at runtime (for settings page)
  setBaseUrl(url: string): void {
    this.baseUrl = url;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('visionweave_api_url', url);
    }
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    // Don't set Content-Type for FormData to allow browser to set boundary
    if (options.body instanceof FormData) {
      delete headers['Content-Type'];
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API Error: ${response.status} - ${error}`);
    }

    if (response.headers.get('content-type')?.includes('application/json')) {
      return response.json();
    }

    return response as T;
  }

  // Health & Status
  async getHealthStatus(): Promise<{ status: string }> {
    return this.request('/healthz');
  }

  async getReadinessStatus(): Promise<ApiStatus> {
    const response = await this.request('/readyz');
    
    // Transform backend response format to frontend expected format
    const components = response.components || {};
    return {
      api: components.api === 'healthy',
      worker: components.workers === 'healthy', // Note: backend uses "workers", frontend expects "worker"
      redis: components.redis === 'healthy',
      gcs: components.gcs === 'healthy'
    };
  }

  // Job Management
  async estimateJob(prompt: string, title?: string): Promise<JobEstimate> {
    return this.request('/jobs/estimate', {
      method: 'POST',
      body: JSON.stringify({ prompt, title }),
    });
  }

  async createJob(prompt: string, title?: string, backend?: string): Promise<{ job_id: string }> {
    const response = await this.request<{ id: string }>('/jobs/', {
      method: 'POST',
      body: JSON.stringify({ 
        prompt, 
        title,
        generator: backend || 'veo3'
      }),
    });
    return { job_id: response.id };
  }

  async getJobs(): Promise<JobStatus[]> {
    return this.request('/jobs/');
  }

  async getJobDetails(jobId: string): Promise<JobDetails> {
    return this.request(`/jobs/${jobId}/details`);
  }

  async getJobStatus(jobId: string): Promise<JobStatus> {
    return this.request(`/jobs/${jobId}`);
  }

  async getJobVideoUrl(jobId: string): Promise<{ video_url: string }> {
    return this.request(`/jobs/${jobId}/video-url`);
  }

  async downloadJobVideo(jobId: string): Promise<Response> {
    return this.request(`/jobs/${jobId}/download`);
  }

  async deleteJob(jobId: string): Promise<void> {
    return this.request(`/jobs/${jobId}`, {
      method: 'DELETE',
    });
  }

  // Transcription
  async uploadForTranscription(file: File): Promise<TranscriptionResult> {
    const formData = new FormData();
    formData.append('file', file);

    return this.request('/transcription/upload', {
      method: 'POST',
      body: formData,
    });
  }

  async downloadTranscription(srtContent: string, filename: string): Promise<Response> {
    return this.request('/transcription/download', {
      method: 'POST',
      body: JSON.stringify({
        srt_content: srtContent,
        filename
      }),
    });
  }

  // Storage / GCS Bucket Browser
  async getStorageInfo(): Promise<any> {
    return this.request('/storage/info');
  }

  async browseStorage(path: string = ''): Promise<any> {
    return this.request(`/storage/browse?path=${encodeURIComponent(path)}`);
  }

  async downloadFromStorage(path: string): Promise<Response> {
    return this.request(`/storage/download?path=${encodeURIComponent(path)}`);
  }

  async streamFromStorage(path: string): string {
    return `${this.baseUrl}/storage/stream?path=${encodeURIComponent(path)}`;
  }
}

export const api = new VisionWeaveAPI();
export default api;
