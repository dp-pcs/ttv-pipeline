
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { formatTimestamp } from '@/lib/utils';
import { getJobResult, cancelJob, gcsUriToStoragePath } from '@/lib/api-v2';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { JobDetailsModal } from './job-details-modal';
import type { DisplayJob } from './dashboard';
import {
  Play,
  Download,
  Trash2,
  Eye,
  Loader2,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
} from 'lucide-react';

interface JobQueueProps {
  jobs: DisplayJob[];
  onJobDeleted: (jobId: string) => void;
  isLoading: boolean;
}

// v2's job status enum (api/models.py JobStatus): queued, started, progress,
// finished, failed, canceled — distinct from the frontend's old (and never
// actually matching) pending/processing/completed/failed/cancelled guesses.
const ACTIVE_STATUSES = new Set(['queued', 'started', 'progress']);

export function JobQueue({ jobs, onJobDeleted, isLoading }: JobQueueProps) {
  const [selectedJob, setSelectedJob] = useState<DisplayJob | null>(null);
  const [loadingActions, setLoadingActions] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  const handleViewDetails = (job: DisplayJob) => {
    setSelectedJob(job);
  };

  const handleDownload = async (jobId: string) => {
    setLoadingActions(prev => ({ ...prev, [`download-${jobId}`]: true }));

    try {
      const result = await getJobResult(jobId);
      const asset = result.preview_assets[0] ?? result.scenes.flatMap((s) => s.clips)[0]?.asset;
      const path = asset ? gcsUriToStoragePath(asset.uri) : null;
      if (!path) {
        throw new Error('No downloadable asset found for this job yet');
      }
      const response = await api.downloadFromStorage(path);

      if (response instanceof Response) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `visionweave-${jobId.slice(0, 8)}${result.result_kind === 'keyframes' ? '.zip' : '.mp4'}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        toast({
          variant: "default",
          title: "Download Started",
          description: "Your file is being downloaded",
        });
      }
    } catch (error) {
      console.error('Download failed:', error);
      toast({
        variant: "destructive",
        title: "Download Failed",
        description: error instanceof Error ? error.message : "Unable to download the result",
      });
    } finally {
      setLoadingActions(prev => ({ ...prev, [`download-${jobId}`]: false }));
    }
  };

  const handleRemove = async (job: DisplayJob) => {
    const isActive = ACTIVE_STATUSES.has(job.status);
    if (!confirm(isActive
      ? 'This job is still running. Cancel it and stop tracking it?'
      : 'Stop tracking this job? (It stays in the backend\'s records; this only removes it from your list.)')) {
      return;
    }

    setLoadingActions(prev => ({ ...prev, [`delete-${job.id}`]: true }));

    try {
      if (isActive) {
        await cancelJob(job.id);
      }
      onJobDeleted(job.id);
    } catch (error) {
      console.error('Remove failed:', error);
      toast({
        variant: "destructive",
        title: "Failed to cancel job",
        description: "Unable to cancel the job; it was not removed from your list",
      });
    } finally {
      setLoadingActions(prev => ({ ...prev, [`delete-${job.id}`]: false }));
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'finished':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'started':
      case 'progress':
        return <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />;
      case 'queued':
        return <Clock className="w-4 h-4 text-yellow-400" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-400" />;
      case 'canceled':
        return <AlertCircle className="w-4 h-4 text-gray-400" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'finished': return 'success';
      case 'started':
      case 'progress': return 'processing';
      case 'queued': return 'pending';
      case 'failed': return 'destructive';
      default: return 'secondary';
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 bg-muted rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
                <div className="w-16 h-6 bg-muted rounded" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <Card className="border-dashed border-muted-foreground/25">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Play className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No jobs yet</h3>
          <p className="text-muted-foreground">
            Create your first video by entering a prompt above
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {jobs.map((job) => (
          <Card key={job.id} className="transition-all duration-200 hover:shadow-lg hover:metallic-glow">
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 mt-1">
                  {getStatusIcon(job.status)}
                </div>

                <div className="flex-1 min-w-0 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h4 className="font-medium truncate">
                        {job.title || `Video ${job.id.slice(0, 8)}`}
                      </h4>
                      {job.prompt && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                          {job.prompt}
                        </p>
                      )}
                    </div>

                    <Badge variant={getStatusVariant(job.status)}>
                      {job.status}
                    </Badge>
                  </div>

                  {(job.status === 'progress' || job.status === 'started') && (
                    <div className="space-y-1">
                      <Progress value={job.progress || 0} className="h-2" />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{job.current_scene_id ? `Scene ${job.current_scene_id}` : 'Processing...'}</span>
                        <span>{Math.round(job.progress || 0)}%</span>
                      </div>
                    </div>
                  )}

                  {job.warnings.length > 0 && (
                    <p className="text-xs text-yellow-400">⚠ {job.warnings[0]}{job.warnings.length > 1 ? ` (+${job.warnings.length - 1} more)` : ''}</p>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {formatTimestamp(job.created_at)}
                    </span>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewDetails(job)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>

                      {job.status === 'finished' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownload(job.id)}
                          disabled={loadingActions[`download-${job.id}`]}
                        >
                          {loadingActions[`download-${job.id}`] ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Download className="w-4 h-4" />
                          )}
                        </Button>
                      )}

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemove(job)}
                        disabled={loadingActions[`delete-${job.id}`]}
                        className="text-red-400 hover:text-red-300"
                      >
                        {loadingActions[`delete-${job.id}`] ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedJob && (
        <JobDetailsModal
          job={selectedJob}
          open={!!selectedJob}
          onClose={() => setSelectedJob(null)}
        />
      )}
    </>
  );
}
