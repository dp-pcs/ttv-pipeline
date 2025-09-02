/**
 * TTV Pipeline Frontend Application
 * Main application logic and UI management
 */

class TTVApp {
    constructor() {
        this.api = new TTVApi();
        this.activeJobs = new Map();
        this.completedJobs = [];
        this.pollInterval = null;
        this.settings = Storage.get('settings', {
            openaiKey: '',
            googleProject: '',
            videoBackend: 'google_veo',
            maxCostPerVideo: 10.00 // Default $10 budget cap
        });

        this.init();
    }

    /**
     * Initialize the application
     */
    init() {
        this.setupNavigation();
        this.setupEventListeners();
        this.setupJobDetailsModal();
        this.setupTranscription();
        this.loadSettings();
        this.startMonitoring();
        this.showNotification('Welcome to CineForge!', 'success');
    }

    /**
     * Setup navigation between sections
     */
    setupNavigation() {
        const navButtons = document.querySelectorAll('.nav-btn');
        const sections = document.querySelectorAll('.section');

        navButtons.forEach(button => {
            button.addEventListener('click', () => {
                const targetSection = button.dataset.section;

                // Update active nav button
                navButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');

                // Show target section
                sections.forEach(section => section.classList.remove('active'));
                document.getElementById(targetSection).classList.add('active');

                // Update section-specific data
                if (targetSection === 'downloads') {
                    this.updateDownloads();
                } else if (targetSection === 'settings') {
                    this.checkSystemStatus();
                }
            });
        });
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Video generation
        document.getElementById('generate-video').addEventListener('click', () => {
            this.generateVideo();
        });

        document.getElementById('clear-prompt').addEventListener('click', () => {
            document.getElementById('video-prompt').value = '';
            document.getElementById('video-title').value = '';
        });

        // Settings
        document.getElementById('save-settings').addEventListener('click', () => {
            this.saveSettings();
        });

        document.getElementById('test-connection').addEventListener('click', () => {
            this.testConnection();
        });

        // Password toggles
        document.querySelectorAll('.toggle-password').forEach(button => {
            button.addEventListener('click', () => {
                const targetId = button.dataset.target;
                const input = document.getElementById(targetId);
                const icon = button.querySelector('i');

                if (input.type === 'password') {
                    input.type = 'text';
                    icon.className = 'fas fa-eye-slash';
                } else {
                    input.type = 'password';
                    icon.className = 'fas fa-eye';
                }
            });
        });

        // Auto-save settings on change
        ['openai-key', 'google-project', 'video-backend', 'max-cost-per-video'].forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('change', () => {
                    this.autoSaveSettings();
                });
            }
        });
    }

    /**
     * Start monitoring system status and jobs
     */
    startMonitoring() {
        // Start connection monitoring
        this.api.startConnectionMonitoring((status) => {
            this.updateConnectionStatus(status);
        });

        // Start job polling
        this.startJobPolling();
    }

    /**
     * Update connection status in header
     */
    updateConnectionStatus(status) {
        const statusDot = document.getElementById('connection-status');
        const statusText = document.getElementById('connection-text');

        if (status.connected) {
            statusDot.className = 'status-dot connected';
            statusText.textContent = 'Connected';
        } else {
            statusDot.className = 'status-dot disconnected';
            statusText.textContent = 'Disconnected';
        }
    }

    /**
     * Start polling for job updates with smart intervals
     */
    startJobPolling() {
        this.stopJobPolling();
        
        const poll = async () => {
            try {
                await this.updateJobs();
                
                // Determine next polling interval based on job activity
                const hasActiveJobs = this.jobs && this.jobs.some(job => 
                    job.status === 'queued' || job.status === 'progress'
                );
                
                // Use shorter interval if there are active jobs, longer if idle
                const interval = hasActiveJobs ? 8000 : 15000; // 8s active, 15s idle
                
                // Schedule next poll
                this.pollTimeout = setTimeout(() => this.startJobPolling(), interval);
                
            } catch (error) {
                console.error('Job polling failed:', error);
                // Retry after longer delay on error
                this.pollTimeout = setTimeout(() => this.startJobPolling(), 20000);
            }
        };

        // Initial update
        poll();
    }

    /**
     * Stop job polling
     */
    stopJobPolling() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
        if (this.pollTimeout) {
            clearTimeout(this.pollTimeout);
            this.pollTimeout = null;
        }
    }

    /**
     * Update jobs display
     */
    async updateJobs() {
        try {
            const jobs = await this.api.getJobs();
            this.displayJobs(jobs);
        } catch (error) {
            // Silently handle errors during polling
            console.warn('Failed to update jobs:', error.message);
        }
    }

    /**
     * Display jobs in the queue
     */
    displayJobs(jobs) {
        const container = document.getElementById('job-queue');
        
        if (!jobs || jobs.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <p>No jobs in queue. Create your first video above!</p>
                </div>
            `;
            return;
        }

        // Sort jobs by creation date (newest first)
        const sortedJobs = [...jobs].sort((a, b) => 
            new Date(b.created_at) - new Date(a.created_at)
        );

        container.innerHTML = sortedJobs.map(job => this.createJobElement(job)).join('');

        // Update completed jobs for downloads
        this.completedJobs = jobs.filter(job => job.status === JobStatus.FINISHED);
    }

    /**
     * Create HTML element for a job
     */
    createJobElement(job) {
        const progress = job.progress || 0;
        const statusColor = JobStatus.getColor(job.status);
        const statusIcon = JobStatus.getIcon(job.status);
        const statusText = JobStatus.getDisplayName(job.status);
        const duration = Utils.formatDuration(job.started_at, job.finished_at);
        const timeAgo = Utils.formatDate(job.created_at);

        // Use custom title if available, otherwise truncate prompt
        const displayTitle = job.title || Utils.truncate(job.prompt || 'Video Generation Job', 60);

        return `
            <div class="job-item" data-job-id="${job.id}" onclick="app.showJobDetails('${job.id}')" style="cursor: pointer;">
                <div class="job-info">
                    <div class="job-title">${displayTitle}</div>
                    <div class="job-status">
                        <i class="${statusIcon}" style="color: ${statusColor}"></i>
                        <span>${statusText}</span>
                        <span>•</span>
                        <span>${timeAgo}</span>
                        ${job.started_at ? `<span>•</span><span>${duration}</span>` : ''}
                    </div>
                </div>
                
                <div class="job-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progress}%"></div>
                    </div>
                    <small>${progress}%</small>
                </div>
                
                <div class="job-actions" onclick="event.stopPropagation();">
                    <button onclick="app.showJobDetails('${job.id}')" title="View Details">
                        <i class="fas fa-info-circle"></i>
                    </button>
                    ${job.status === JobStatus.FINISHED ? 
                        `<button onclick="app.downloadJob('${job.id}')" title="Download">
                            <i class="fas fa-download"></i>
                        </button>` : ''
                    }
                    ${job.status === JobStatus.FAILED ? 
                        `<button onclick="app.retryJob('${job.id}')" title="Retry">
                            <i class="fas fa-redo"></i>
                        </button>` : ''
                    }
                    ${job.status === JobStatus.PROGRESS || job.status === JobStatus.QUEUED ? 
                        `<button onclick="app.cancelJob('${job.id}')" title="Cancel">
                            <i class="fas fa-times"></i>
                        </button>` : ''
                    }
                    ${job.status === JobStatus.FINISHED || job.status === JobStatus.FAILED ? 
                        `<button onclick="app.deleteJob('${job.id}')" title="Delete" class="delete-btn">
                            <i class="fas fa-trash"></i>
                        </button>` : ''
                    }
                </div>
            </div>
        `;
    }

    /**
     * Generate video from prompt
     */
    async generateVideo() {
        const promptInput = document.getElementById('video-prompt');
        const titleInput = document.getElementById('video-title');
        const prompt = promptInput.value.trim();
        const title = titleInput.value.trim();

        if (!prompt) {
            this.showNotification('Please enter a video prompt', 'error');
            return;
        }

        try {
            // Step 1: Get cost estimation first
            this.showLoading('Analyzing prompt and estimating cost...');
            
            const estimation = await this.api.estimateJobCost(prompt, title);
            
            this.hideLoading();
            
            // Step 2: Check budget limit
            const maxCost = this.settings.maxCostPerVideo || 10.00;
            if (maxCost > 0 && estimation.total_estimated_cost > maxCost) {
                this.showNotification(
                    `Estimated cost $${estimation.total_estimated_cost.toFixed(2)} exceeds your budget limit of $${maxCost.toFixed(2)}. ` +
                    `Please adjust your prompt or increase the budget in Settings.`, 
                    'error'
                );
                return;
            }
            
            // Step 3: Show cost confirmation dialog
            const confirmed = await this.showCostConfirmation(estimation);
            
            if (!confirmed) {
                return; // User cancelled
            }
            
            // Step 3: Create actual job
            this.showLoading('Creating video generation job...');
            
            const job = await this.api.createJob(prompt, title);
            
            this.hideLoading();
            this.showNotification('Video generation job created!', 'success');
            
            // Clear the inputs
            promptInput.value = '';
            titleInput.value = '';
            
            // Immediately update jobs
            this.updateJobs();
            
        } catch (error) {
            this.hideLoading();
            this.showNotification(`Failed to create job: ${error.message}`, 'error');
        }
    }

    /**
     * Show cost confirmation dialog
     */
    async showCostConfirmation(estimation) {
        return new Promise((resolve) => {
            // Create modal overlay
            const overlay = document.createElement('div');
            overlay.className = 'cost-confirmation-overlay';
            overlay.innerHTML = `
                <div class="cost-confirmation-modal">
                    <div class="modal-header">
                        <h3><i class="fas fa-calculator"></i> Cost Estimation</h3>
                        <button class="modal-close" onclick="this.closest('.cost-confirmation-overlay').remove(); resolve(false);">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    
                    <div class="modal-body">
                        <div class="estimation-summary">
                            <div class="cost-highlight">
                                <span class="cost-label">Total Estimated Cost:</span>
                                <span class="cost-value">$${estimation.total_estimated_cost.toFixed(2)}</span>
                            </div>
                        </div>
                        
                        <div class="estimation-details">
                            <h4>Generation Details:</h4>
                            <div class="detail-grid">
                                <div class="detail-item">
                                    <span class="detail-label">Video Segments:</span>
                                    <span class="detail-value">${estimation.estimated_segments}</span>
                                </div>
                                <div class="detail-item">
                                    <span class="detail-label">Total Duration:</span>
                                    <span class="detail-value">${estimation.total_duration}s</span>
                                </div>
                                <div class="detail-item">
                                    <span class="detail-label">Cost per Segment:</span>
                                    <span class="detail-value">$${estimation.cost_per_segment.toFixed(2)}</span>
                                </div>
                                <div class="detail-item">
                                    <span class="detail-label">Backend:</span>
                                    <span class="detail-value">${estimation.backend}</span>
                                </div>
                            </div>
                        </div>
                        
                        ${estimation.reasoning ? `
                            <div class="estimation-reasoning">
                                <h4>AI Analysis:</h4>
                                <p>"${estimation.reasoning}"</p>
                            </div>
                        ` : ''}
                        
                        <div class="modal-warning">
                            <i class="fas fa-info-circle"></i>
                            <span>This is an estimate. Actual costs may vary slightly.</span>
                        </div>
                    </div>
                    
                    <div class="modal-actions">
                        <button class="btn-secondary cancel-btn">
                            <i class="fas fa-times"></i> Cancel
                        </button>
                        <button class="btn-primary confirm-btn">
                            <i class="fas fa-check"></i> Generate Video ($${estimation.total_estimated_cost.toFixed(2)})
                        </button>
                    </div>
                </div>
            `;
            
            // Add modal styles
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.7);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
            `;
            
            // Add event listeners
            overlay.querySelector('.cancel-btn').addEventListener('click', () => {
                overlay.remove();
                resolve(false);
            });
            
            overlay.querySelector('.confirm-btn').addEventListener('click', () => {
                overlay.remove();
                resolve(true);
            });
            
            overlay.querySelector('.modal-close').addEventListener('click', () => {
                overlay.remove();
                resolve(false);
            });
            
            // Close on background click
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    overlay.remove();
                    resolve(false);
                }
            });
            
            document.body.appendChild(overlay);
        });
    }

    /**
     * Download completed job
     */
    async downloadJob(jobId) {
        try {
            const job = await this.api.getJob(jobId);
            
            if (job.status !== JobStatus.FINISHED) {
                this.showNotification('Video not ready for download yet', 'error');
                return;
            }
            
            if (!job.gcs_uri) {
                this.showNotification('No download available for this job', 'error');
                return;
            }

            const filename = Utils.generateFilename(job.title || job.prompt || 'video');
            await this.api.downloadVideo(jobId, filename);
            
            this.showNotification('Download started!', 'success');
            
        } catch (error) {
            this.showNotification(`Download failed: ${error.message}`, 'error');
        }
    }

    /**
     * Cancel job
     */
    async cancelJob(jobId) {
        try {
            await this.api.deleteJob(jobId);
            this.showNotification('Job cancelled', 'success');
            this.updateJobs();
        } catch (error) {
            this.showNotification(`Failed to cancel job: ${error.message}`, 'error');
        }
    }

    /**
     * Delete job from dashboard
     */
    async deleteJob(jobId) {
        const confirmed = confirm('Are you sure you want to delete this job? This action cannot be undone.');
        
        if (!confirmed) {
            return;
        }

        try {
            await this.api.deleteJob(jobId);
            this.showNotification('Job deleted', 'success');
            this.updateJobs();
        } catch (error) {
            this.showNotification(`Failed to delete job: ${error.message}`, 'error');
        }
    }

    /**
     * Retry failed job
     */
    async retryJob(jobId) {
        try {
            const job = await this.api.getJob(jobId);
            const newJob = await this.api.createJob(job.prompt);
            
            this.showNotification('Job resubmitted!', 'success');
            this.updateJobs();
            
        } catch (error) {
            this.showNotification(`Failed to retry job: ${error.message}`, 'error');
        }
    }

    /**
     * Load settings from storage
     */
    loadSettings() {
        document.getElementById('openai-key').value = this.settings.openaiKey;
        document.getElementById('google-project').value = this.settings.googleProject;
        document.getElementById('video-backend').value = this.settings.videoBackend;
        document.getElementById('max-cost-per-video').value = this.settings.maxCostPerVideo;
    }

    /**
     * Save settings
     */
    saveSettings() {
        this.settings = {
            openaiKey: document.getElementById('openai-key').value,
            googleProject: document.getElementById('google-project').value,
            videoBackend: document.getElementById('video-backend').value,
            maxCostPerVideo: parseFloat(document.getElementById('max-cost-per-video').value) || 10.00,
        };

        Storage.set('settings', this.settings);
        this.showNotification('Settings saved!', 'success');
    }

    /**
     * Auto-save settings on change
     */
    autoSaveSettings() {
        this.saveSettings();
    }

    /**
     * Test API connection
     */
    async testConnection() {
        try {
            this.showLoading('Testing connection...');
            
            const status = await this.api.checkHealth();
            
            this.hideLoading();
            
            if (status.connected) {
                this.showNotification('Connection successful!', 'success');
            } else {
                this.showNotification(`Connection failed: ${status.error}`, 'error');
            }
            
            this.checkSystemStatus();
            
        } catch (error) {
            this.hideLoading();
            this.showNotification(`Connection test failed: ${error.message}`, 'error');
        }
    }

    /**
     * Check system status for settings page
     */
    async checkSystemStatus() {
        try {
            const status = await this.api.checkHealth();
            
            if (status.connected && status.ready.components) {
                const components = status.ready.components;
                
                this.updateStatusIndicator('api-status', status.health.status === 'healthy');
                this.updateStatusIndicator('redis-status', components.redis === 'healthy');
                this.updateStatusIndicator('worker-status', components.workers === 'healthy');
                this.updateStatusIndicator('gcs-status', components.gcs === 'healthy');
            } else {
                // Set all to unhealthy if not connected
                ['api-status', 'redis-status', 'worker-status', 'gcs-status'].forEach(id => {
                    this.updateStatusIndicator(id, false);
                });
            }
        } catch (error) {
            console.error('Status check failed:', error);
        }
    }

    /**
     * Update status indicator
     */
    updateStatusIndicator(elementId, isHealthy) {
        const element = document.getElementById(elementId);
        if (element) {
            if (isHealthy) {
                element.textContent = 'Healthy';
                element.className = 'status-value healthy';
            } else {
                element.textContent = 'Unhealthy';
                element.className = 'status-value unhealthy';
                    }
    }

    /**
     * Setup transcription functionality
     */
    setupTranscription() {
        this.selectedAudioFile = null;
        this.currentTranscription = null;
        
        // File upload elements
        const audioUploadArea = document.getElementById('audio-upload-area');
        const audioFileInput = document.getElementById('audio-file');
        const fileInfo = document.getElementById('file-info');
        const fileName = document.getElementById('file-name');
        const fileSize = document.getElementById('file-size');
        const removeFileBtn = document.getElementById('remove-file');
        const transcribeBtn = document.getElementById('transcribe-audio');
        const downloadBtn = document.getElementById('download-transcript');
        const copyBtn = document.getElementById('copy-transcript');
        const formatSelect = document.getElementById('transcript-format');
        const transcriptText = document.getElementById('transcript-text');
        const transcriptionResult = document.getElementById('transcription-result');

        // File upload click handler
        audioUploadArea.addEventListener('click', () => {
            audioFileInput.click();
        });

        // File input change handler
        audioFileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleFileSelection(e.target.files[0]);
            }
        });

        // Drag and drop handlers
        audioUploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            audioUploadArea.classList.add('dragover');
        });

        audioUploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            audioUploadArea.classList.remove('dragover');
        });

        audioUploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            audioUploadArea.classList.remove('dragover');
            if (e.dataTransfer.files.length > 0) {
                this.handleFileSelection(e.dataTransfer.files[0]);
            }
        });

        // Remove file handler
        removeFileBtn.addEventListener('click', () => {
            this.clearFileSelection();
        });

        // Transcribe button handler
        transcribeBtn.addEventListener('click', () => {
            this.transcribeAudio();
        });

        // Download transcript handler
        downloadBtn.addEventListener('click', () => {
            this.downloadTranscript();
        });

        // Copy transcript handler
        copyBtn.addEventListener('click', () => {
            this.copyTranscript();
        });

        // Format change handler
        formatSelect.addEventListener('change', () => {
            this.updateTranscriptDisplay();
        });
    }

    /**
     * Handle file selection for transcription
     */
    handleFileSelection(file) {
        // Validate file type
        const validTypes = ['audio/', 'video/mp4'];
        if (!validTypes.some(type => file.type.startsWith(type))) {
            this.showNotification('Please select an audio or video file.', 'error');
            return;
        }

        // Validate file size (25MB limit)
        if (file.size > 25 * 1024 * 1024) {
            this.showNotification('File too large. Maximum size is 25MB.', 'error');
            return;
        }

        this.selectedAudioFile = file;
        
        // Update UI
        document.getElementById('file-name').textContent = file.name;
        document.getElementById('file-size').textContent = `${(file.size / 1024 / 1024).toFixed(2)} MB`;
        document.getElementById('file-info').style.display = 'flex';
        document.getElementById('transcribe-audio').disabled = false;
        
        // Hide previous results
        document.getElementById('transcription-result').style.display = 'none';
        document.getElementById('download-transcript').style.display = 'none';
    }

    /**
     * Clear file selection
     */
    clearFileSelection() {
        this.selectedAudioFile = null;
        this.currentTranscription = null;
        
        // Reset UI
        document.getElementById('audio-file').value = '';
        document.getElementById('file-info').style.display = 'none';
        document.getElementById('transcribe-audio').disabled = true;
        document.getElementById('transcription-result').style.display = 'none';
        document.getElementById('download-transcript').style.display = 'none';
    }

    /**
     * Transcribe the selected audio file
     */
    async transcribeAudio() {
        if (!this.selectedAudioFile) {
            this.showNotification('Please select an audio file first.', 'error');
            return;
        }

        try {
            this.showLoading('Transcribing audio... This may take a few minutes.');
            
            const result = await this.api.transcribeAudio(this.selectedAudioFile);
            this.currentTranscription = result;
            
            this.hideLoading();
            
            // Update UI
            this.updateTranscriptDisplay();
            document.getElementById('transcription-result').style.display = 'block';
            document.getElementById('download-transcript').style.display = 'inline-flex';
            
            this.showNotification('Audio transcribed successfully!', 'success');
            
        } catch (error) {
            this.hideLoading();
            this.showNotification(`Transcription failed: ${error.message}`, 'error');
        }
    }

    /**
     * Update transcript display based on selected format
     */
    updateTranscriptDisplay() {
        if (!this.currentTranscription) return;
        
        const format = document.getElementById('transcript-format').value;
        const transcriptText = document.getElementById('transcript-text');
        
        if (format === 'text') {
            // Extract text without timestamps from SRT
            const plainText = this.currentTranscription.text
                .replace(/\d+\n/g, '') // Remove sequence numbers
                .replace(/\d{2}:\d{2}:\d{2},\d{3} --> \d{2}:\d{2}:\d{2},\d{3}\n/g, '') // Remove timestamps
                .replace(/\n\n/g, '\n') // Remove extra line breaks
                .trim();
            transcriptText.textContent = plainText;
        } else {
            // Show SRT format with timestamps
            transcriptText.textContent = this.currentTranscription.text;
        }
    }

    /**
     * Download transcript as file
     */
    async downloadTranscript() {
        if (!this.selectedAudioFile || !this.currentTranscription) {
            this.showNotification('No transcription available to download.', 'error');
            return;
        }

        try {
            const filename = `${this.selectedAudioFile.name.split('.')[0]}_transcript.srt`;
            await this.api.downloadTranscription(this.selectedAudioFile, filename);
            this.showNotification('Transcript downloaded!', 'success');
        } catch (error) {
            this.showNotification(`Download failed: ${error.message}`, 'error');
        }
    }

    /**
     * Copy transcript to clipboard
     */
    async copyTranscript() {
        if (!this.currentTranscription) {
            this.showNotification('No transcription available to copy.', 'error');
            return;
        }

        try {
            const format = document.getElementById('transcript-format').value;
            let textToCopy;
            
            if (format === 'text') {
                textToCopy = this.currentTranscription.text
                    .replace(/\d+\n/g, '')
                    .replace(/\d{2}:\d{2}:\d{2},\d{3} --> \d{2}:\d{2}:\d{2},\d{3}\n/g, '')
                    .replace(/\n\n/g, '\n')
                    .trim();
            } else {
                textToCopy = this.currentTranscription.text;
            }
            
            await navigator.clipboard.writeText(textToCopy);
            this.showNotification('Transcript copied to clipboard!', 'success');
        } catch (error) {
            this.showNotification('Failed to copy transcript.', 'error');
        }
    }
}

    /**
     * Update downloads section
     */
    updateDownloads() {
        const container = document.getElementById('downloads-list');
        
        if (this.completedJobs.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-video"></i>
                    <p>No completed videos yet. Generate your first video to see downloads here!</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.completedJobs.map(job => `
            <div class="download-item">
                <div class="download-info">
                    <div class="download-title">${job.title || Utils.truncate(job.prompt, 60)}</div>
                    <div class="download-meta">
                        Completed ${Utils.formatDate(job.finished_at)} • 
                        Duration: ${Utils.formatDuration(job.started_at, job.finished_at)}
                    </div>
                </div>
                <div class="download-actions">
                    <button class="btn-primary" onclick="app.downloadJob('${job.id}')">
                        <i class="fas fa-download"></i> Download
                    </button>
                </div>
            </div>
        `).join('');
    }

    /**
     * Show notification toast
     */
    showNotification(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icon = type === 'success' ? 'check-circle' : 
                    type === 'error' ? 'times-circle' : 
                    type === 'warning' ? 'exclamation-triangle' : 'info-circle';
        
        toast.innerHTML = `
            <i class="fas fa-${icon}"></i>
            <span>${message}</span>
        `;
        
        container.appendChild(toast);
        
        // Trigger animation
        setTimeout(() => toast.classList.add('show'), 100);
        
        // Auto remove
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => container.removeChild(toast), 300);
        }, 4000);
    }

    /**
     * Setup job details modal
     */
    setupJobDetailsModal() {
        const modal = document.getElementById('jobDetailsModal');
        const closeBtn = modal.querySelector('.close');
        const closeDetailsBtn = document.getElementById('closeDetailsBtn');
        const copyJobIdBtn = document.getElementById('copyJobIdBtn');
        const tabButtons = modal.querySelectorAll('.tab-button');

        // Close modal handlers
        closeBtn.addEventListener('click', () => this.hideJobDetailsModal());
        closeDetailsBtn.addEventListener('click', () => this.hideJobDetailsModal());

        // Close modal when clicking outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.hideJobDetailsModal();
            }
        });

        // Tab switching
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const targetTab = button.dataset.tab;
                this.switchJobDetailsTab(targetTab);
            });
        });

        // Copy job ID
        copyJobIdBtn.addEventListener('click', () => this.copyJobId());
    }

    /**
     * Show job details modal with request debouncing
     */
    async showJobDetails(jobId) {
        console.log('showJobDetails called with jobId:', jobId);
        
        // Prevent multiple rapid requests for the same job
        if (this.loadingJobDetails === jobId) {
            console.log('Already loading this job, skipping');
            return; // Already loading this job
        }

        try {
            this.loadingJobDetails = jobId;
            this.showLoading('Loading job details...');
            
            console.log('Fetching job details for:', jobId);
            const details = await this.api.getJobDetails(jobId);
            console.log('Got job details:', details);
            
            this.hideLoading();

            this.populateJobDetails(details);
            this.showJobDetailsModal();
        } catch (error) {
            console.error('Error loading job details:', error);
            this.hideLoading();
            if (error.message.includes('429')) {
                this.showNotification('Rate limit exceeded. Please wait a moment and try again.', 'warning');
            } else {
                this.showNotification(`Failed to load job details: ${error.message}`, 'error');
            }
        } finally {
            this.loadingJobDetails = null;
        }
    }

    /**
     * Populate job details in modal
     */
    populateJobDetails(details) {
        // Store current job details for copying
        this.currentJobDetails = details;

        // Overview tab
        document.getElementById('detailJobId').textContent = details.id;
        document.getElementById('detailTitle').textContent = details.title || 'No title';
        document.getElementById('detailStatus').textContent = details.status;
        document.getElementById('detailProgress').textContent = `${details.progress}%`;
        document.getElementById('detailCreated').textContent = Utils.formatDate(details.created_at);
        document.getElementById('detailStarted').textContent = details.started_at ? Utils.formatDate(details.started_at) : 'Not started';
        document.getElementById('detailFinished').textContent = details.finished_at ? Utils.formatDate(details.finished_at) : 'Not finished';
        document.getElementById('detailProcessingTime').textContent = details.processing_time ? `${details.processing_time.toFixed(2)}s` : 'N/A';
        document.getElementById('detailError').textContent = details.error || 'No errors';
        document.getElementById('detailPrompt').textContent = details.prompt;

        // Show/hide error field based on status
        const errorItem = document.getElementById('detailError').closest('.detail-item');
        if (details.error) {
            errorItem.style.display = 'flex';
        } else {
            errorItem.style.display = 'none';
        }

        // Logs tab
        const logsContent = document.getElementById('detailLogs');
        if (details.logs && details.logs.length > 0) {
            logsContent.textContent = details.logs.join('\n');
        } else {
            logsContent.textContent = 'No logs available';
        }

        // Config tab
        const configContent = document.getElementById('detailConfig');
        configContent.textContent = JSON.stringify(details.config, null, 2);
    }

    /**
     * Switch job details tab
     */
    switchJobDetailsTab(tabName) {
        // Update tab buttons
        const tabButtons = document.querySelectorAll('.tab-button');
        tabButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        // Update tab panes
        const tabPanes = document.querySelectorAll('.tab-pane');
        tabPanes.forEach(pane => {
            pane.classList.toggle('active', pane.id === `${tabName}-tab`);
        });
    }

    /**
     * Show job details modal
     */
    showJobDetailsModal() {
        const modal = document.getElementById('jobDetailsModal');
        console.log('Showing job details modal:', modal);
        
        if (!modal) {
            console.error('Job details modal not found!');
            return;
        }
        
        modal.style.display = 'flex';
        modal.style.position = 'fixed';
        modal.style.top = '0';
        modal.style.left = '0';
        modal.style.width = '100%';
        modal.style.height = '100%';
        modal.style.zIndex = '9999';
        
        document.body.style.overflow = 'hidden';
        console.log('Modal should now be visible');
    }

    /**
     * Hide job details modal
     */
    hideJobDetailsModal() {
        const modal = document.getElementById('jobDetailsModal');
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }

    /**
     * Copy job ID to clipboard
     */
    async copyJobId() {
        if (!this.currentJobDetails) return;

        try {
            await navigator.clipboard.writeText(this.currentJobDetails.id);
            this.showNotification('Job ID copied to clipboard!', 'success');
        } catch (error) {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = this.currentJobDetails.id;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            this.showNotification('Job ID copied to clipboard!', 'success');
        }
    }

    /**
     * Show loading overlay
     */
    showLoading(message = 'Loading...') {
        const overlay = document.getElementById('loading-overlay');
        const text = overlay.querySelector('p');
        text.textContent = message;
        overlay.classList.remove('hidden');
    }

    /**
     * Hide loading overlay
     */
    hideLoading() {
        const overlay = document.getElementById('loading-overlay');
        overlay.classList.add('hidden');
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new TTVApp();
});

// Handle page unload
window.addEventListener('beforeunload', () => {
    if (window.app) {
        window.app.api.stopConnectionMonitoring();
        window.app.stopJobPolling();
    }
});
