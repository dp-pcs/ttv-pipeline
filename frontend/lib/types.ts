
// API Types for VisionWeave Backend Integration
export interface JobStatus {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  created_at: string;
  updated_at: string;
  title?: string;
  prompt?: string;
  estimated_cost?: number;
  error_message?: string;
}

export interface JobDetails extends JobStatus {
  config: Record<string, any>;
  logs: string[];
  duration?: number;
  segments?: number;
}

export interface JobEstimate {
  segments: number;
  duration: number;
  cost: number;
  breakdown: {
    segment_cost: number;
    total_segments: number;
  };
}

export interface TranscriptionResult {
  srt_content: string;
  plain_text: string;
  duration: number;
  language?: string;
}

export interface ApiStatus {
  api: boolean;
  worker: boolean;
  redis: boolean;
  gcs: boolean;
}

export interface AppSettings {
  openai_api_key?: string;
  google_project_id?: string;
  backend_selection: 'google_veo' | 'runway' | 'minimax';
  budget_cap: number;
  api_base_url: string;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  description?: string;
  duration?: number;
}
