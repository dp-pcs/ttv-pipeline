/**
 * API Helper for TTV Pipeline Frontend
 * Handles all communication with the backend API
 */

class TTVApi {
    constructor(baseUrl = 'http://localhost:8000') {
        this.baseUrl = baseUrl;
        this.isConnected = false;
        this.connectionCheckInterval = null;
    }

    /**
     * Make HTTP request to API
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
            },
        };

        try {
            const response = await fetch(url, {
                ...defaultOptions,
                ...options,
                headers: {
                    ...defaultOptions.headers,
                    ...options.headers,
                },
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('API Request failed:', error);
            throw error;
        }
    }

    /**
     * Check API health and readiness
     */
    async checkHealth() {
        try {
            const health = await this.request('/healthz');
            const ready = await this.request('/readyz');
            
            this.isConnected = true;
            return {
                connected: true,
                health,
                ready,
                components: ready.components || {}
            };
        } catch (error) {
            this.isConnected = false;
            return {
                connected: false,
                error: error.message
            };
        }
    }

    /**
     * Start periodic connection checking
     */
    startConnectionMonitoring(callback, interval = 5000) {
        this.stopConnectionMonitoring();
        
        const check = async () => {
            const status = await this.checkHealth();
            callback(status);
        };

        // Initial check
        check();
        
        // Set up periodic checking
        this.connectionCheckInterval = setInterval(check, interval);
    }

    /**
     * Stop connection monitoring
     */
    stopConnectionMonitoring() {
        if (this.connectionCheckInterval) {
            clearInterval(this.connectionCheckInterval);
            this.connectionCheckInterval = null;
        }
    }

    /**
     * Estimate job cost and segments
     */
    async estimateJobCost(prompt, title = null) {
        const payload = { prompt };
        if (title) {
            payload.title = title;
        }
        
        return await this.request('/jobs/estimate', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    }

    /**
     * Create a new video generation job
     */
    async createJob(prompt, title = null) {
        const payload = { prompt };
        if (title) {
            payload.title = title;
        }
        
        return await this.request('/jobs/', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    }

    /**
     * Get all jobs
     */
    async getJobs() {
        return await this.request('/jobs/');
    }

    /**
     * Get specific job by ID
     */
    async getJob(jobId) {
        return await this.request(`/jobs/${jobId}`);
    }

    async getJobDetails(jobId) {
        return await this.request(`/jobs/${jobId}/details`);
    }

    /**
     * Transcribe audio file to text with timestamps
     */
    async transcribeAudio(audioFile) {
        const formData = new FormData();
        formData.append('file', audioFile);

        return await this.request('/transcription/upload', {
            method: 'POST',
            body: formData
        });
    }

    /**
     * Download transcription as SRT file
     */
    async downloadTranscription(audioFile, filename) {
        const formData = new FormData();
        formData.append('file', audioFile);

        const response = await fetch(`${this.baseURL}/transcription/download`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || 'transcript.srt';
        
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => {
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        }, 100);

        return true;
    }

    /**
     * Delete/cancel a job
     */
    async deleteJob(jobId) {
        return await this.request(`/jobs/${jobId}`, {
            method: 'DELETE',
        });
    }

    /**
     * Get job artifacts (if available)
     */
    async getJobArtifacts(jobId) {
        try {
            return await this.request(`/jobs/${jobId}/artifacts`);
        } catch (error) {
            // Artifacts endpoint might not exist yet
            return [];
        }
    }

    /**
     * Download video file using backend proxy
     */
    async downloadVideo(jobId, filename) {
        try {
            console.log(`Starting download for job ${jobId} with filename:`, filename);
            
            // Use the backend download endpoint that proxies from GCS
            const downloadUrl = `${this.baseURL}/jobs/${jobId}/download`;
            console.log('Downloading from backend endpoint:', downloadUrl);
            
            // Create download link pointing to our backend
            const a = document.createElement('a');
            a.href = downloadUrl;
            
            // The backend will set the filename in Content-Disposition header
            // but we can also set a fallback filename
            if (filename) {
                a.download = filename;
            }
            
            a.style.display = 'none';
            document.body.appendChild(a);
            
            console.log('Triggering download from backend proxy');
            a.click();
            
            // Cleanup
            setTimeout(() => {
                document.body.removeChild(a);
            }, 100);
            
            return true;
        } catch (error) {
            console.error('Download failed:', error);
            throw error;
        }
    }

    /**
     * Get system configuration
     */
    async getConfig() {
        try {
            return await this.request('/config');
        } catch (error) {
            // Config endpoint might not exist
            return {};
        }
    }

    /**
     * Update system configuration
     */
    async updateConfig(config) {
        try {
            return await this.request('/config', {
                method: 'PUT',
                body: JSON.stringify(config),
            });
        } catch (error) {
            console.error('Config update failed:', error);
            throw error;
        }
    }
}

/**
 * Job Status Helper
 */
class JobStatus {
    static QUEUED = 'queued';
    static PROGRESS = 'progress';
    static FINISHED = 'finished';
    static FAILED = 'failed';
    static CANCELLED = 'cancelled';

    static getDisplayName(status) {
        const statusMap = {
            [this.QUEUED]: 'Queued',
            [this.PROGRESS]: 'Processing',
            [this.FINISHED]: 'Completed',
            [this.FAILED]: 'Failed',
            [this.CANCELLED]: 'Cancelled',
        };
        return statusMap[status] || status;
    }

    static getIcon(status) {
        const iconMap = {
            [this.QUEUED]: 'fas fa-clock',
            [this.PROGRESS]: 'fas fa-spinner fa-spin',
            [this.FINISHED]: 'fas fa-check-circle',
            [this.FAILED]: 'fas fa-times-circle',
            [this.CANCELLED]: 'fas fa-ban',
        };
        return iconMap[status] || 'fas fa-question-circle';
    }

    static getColor(status) {
        const colorMap = {
            [this.QUEUED]: 'var(--warning-color)',
            [this.PROGRESS]: 'var(--primary-color)',
            [this.FINISHED]: 'var(--success-color)',
            [this.FAILED]: 'var(--error-color)',
            [this.CANCELLED]: 'var(--text-muted)',
        };
        return colorMap[status] || 'var(--text-secondary)';
    }
}

/**
 * Local Storage Helper
 */
class Storage {
    static set(key, value) {
        try {
            localStorage.setItem(`ttv_${key}`, JSON.stringify(value));
        } catch (error) {
            console.warn('Failed to save to localStorage:', error);
        }
    }

    static get(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(`ttv_${key}`);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.warn('Failed to read from localStorage:', error);
            return defaultValue;
        }
    }

    static remove(key) {
        try {
            localStorage.removeItem(`ttv_${key}`);
        } catch (error) {
            console.warn('Failed to remove from localStorage:', error);
        }
    }

    static clear() {
        try {
            const keys = Object.keys(localStorage).filter(key => key.startsWith('ttv_'));
            keys.forEach(key => localStorage.removeItem(key));
        } catch (error) {
            console.warn('Failed to clear localStorage:', error);
        }
    }
}

/**
 * Utility Functions
 */
class Utils {
    /**
     * Format date for display
     */
    static formatDate(dateString) {
        if (!dateString) return 'N/A';
        
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        
        return date.toLocaleDateString();
    }

    /**
     * Format duration
     */
    static formatDuration(startTime, endTime) {
        if (!startTime) return 'N/A';
        
        const start = new Date(startTime);
        const end = endTime ? new Date(endTime) : new Date();
        const diffMs = end - start;
        const diffSecs = Math.floor(diffMs / 1000);
        const diffMins = Math.floor(diffSecs / 60);

        if (diffSecs < 60) return `${diffSecs}s`;
        if (diffMins < 60) return `${diffMins}m ${diffSecs % 60}s`;
        
        const hours = Math.floor(diffMins / 60);
        return `${hours}h ${diffMins % 60}m`;
    }

    /**
     * Truncate text
     */
    static truncate(text, length = 50) {
        if (!text || text.length <= length) return text;
        return text.substring(0, length) + '...';
    }

    /**
     * Generate filename from title or prompt
     */
    static generateFilename(text, extension = 'mp4') {
        if (!text || text.trim() === '') {
            text = 'video';
        }
        
        // Use longer length for titles, shorter for prompts
        const maxLength = text.length < 100 ? text.length : 50;
        const truncated = text.substring(0, maxLength).trim();
        
        const sanitized = truncated
            .replace(/[^a-zA-Z0-9\s\-_]/g, '') // Allow hyphens and underscores
            .replace(/\s+/g, '_') // Replace spaces with underscores
            .replace(/_+/g, '_') // Replace multiple underscores with single
            .replace(/^_|_$/g, '') // Remove leading/trailing underscores
            .toLowerCase();
        
        // Add timestamp to avoid conflicts
        const timestamp = new Date().toISOString().split('T')[0];
        const finalName = sanitized ? `${sanitized}_${timestamp}` : `video_${timestamp}`;
        
        return `${finalName}.${extension}`;
    }
}

// Export to global scope for use in app.js
window.TTVApi = TTVApi;
window.JobStatus = JobStatus;
window.Storage = Storage;
window.Utils = Utils;
