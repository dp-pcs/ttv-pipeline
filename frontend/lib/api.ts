
'use client';

import { JobStatus, JobDetails, JobEstimate, TranscriptionResult, ApiStatus } from './types';

class VisionWeaveAPI {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:8000') {
    this.baseUrl = baseUrl;
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
    return this.request('/readyz');
  }

  // Job Management
  async estimateJob(prompt: string, title?: string): Promise<JobEstimate> {
    return this.request('/jobs/estimate', {
      method: 'POST',
      body: JSON.stringify({ prompt, title }),
    });
  }

  async createJob(prompt: string, title?: string, backend?: string): Promise<{ job_id: string }> {
    return this.request('/jobs/', {
      method: 'POST',
      body: JSON.stringify({ 
        prompt, 
        title,
        generator: backend || 'minimax'
      }),
    });
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
}

export const api = new VisionWeaveAPI();
export default api;
