
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { JobStatus, JobDetails } from '@/lib/types';
import { formatTimestamp, getJobStatusColor, cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { JobDetailsModal } from './job-details-modal';
import {
  Play,
  Pause,
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
  jobs: JobStatus[];
  onJobDeleted: (jobId: string) => void;
  isLoading: boolean;
}

export function JobQueue({ jobs, onJobDeleted, isLoading }: JobQueueProps) {
  const [selectedJob, setSelectedJob] = useState<JobDetails | null>(null);
  const [loadingActions, setLoadingActions] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  const handleViewDetails = async (jobId: string) => {
    setLoadingActions(prev => ({ ...prev, [jobId]: true }));
    
    try {
      const details = await api.getJobDetails(jobId);
      setSelectedJob(details);
    } catch (error) {
      console.error('Failed to fetch job details:', error);
      toast({
        variant: "destructive",
        title: "Failed to load job details",
        description: "Unable to fetch job information",
      });
    } finally {
      setLoadingActions(prev => ({ ...prev, [jobId]: false }));
    }
  };

  const handleDownload = async (jobId: string) => {
    setLoadingActions(prev => ({ ...prev, [`download-${jobId}`]: true }));
    
    try {
      const response = await api.downloadJobVideo(jobId);
      
      if (response instanceof Response) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cineforge-${jobId.slice(0, 8)}.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        toast({
          variant: "default",
          title: "Download Started",
          description: "Your video is being downloaded",
        });
      }
    } catch (error) {
      console.error('Download failed:', error);
      toast({
        variant: "destructive",
        title: "Download Failed",
        description: "Unable to download video file",
      });
    } finally {
      setLoadingActions(prev => ({ ...prev, [`download-${jobId}`]: false }));
    }
  };

  const handleDelete = async (jobId: string) => {
    if (!confirm('Are you sure you want to delete this job? This action cannot be undone.')) {
      return;
    }

    setLoadingActions(prev => ({ ...prev, [`delete-${jobId}`]: true }));
    
    try {
      await api.deleteJob(jobId);
      onJobDeleted(jobId);
    } catch (error) {
      console.error('Delete failed:', error);
      toast({
        variant: "destructive",
        title: "Delete Failed",
        description: "Unable to delete job",
      });
    } finally {
      setLoadingActions(prev => ({ ...prev, [`delete-${jobId}`]: false }));
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'processing':
        return <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-400" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-400" />;
      case 'cancelled':
        return <AlertCircle className="w-4 h-4 text-gray-400" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'processing': return 'processing';
      case 'pending': return 'pending';
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

                  {job.status === 'processing' && (
                    <div className="space-y-1">
                      <Progress value={job.progress || 0} className="h-2" />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Processing...</span>
                        <span>{Math.round(job.progress || 0)}%</span>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {formatTimestamp(job.created_at)}
                    </span>
                    
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewDetails(job.id)}
                        disabled={loadingActions[job.id]}
                      >
                        {loadingActions[job.id] ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </Button>

                      {job.status === 'completed' && (
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
                        onClick={() => handleDelete(job.id)}
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
