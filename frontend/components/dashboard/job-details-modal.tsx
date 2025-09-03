
'use client';

import { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { JobDetails } from '@/lib/types';
import { formatTimestamp, formatDuration, formatCurrency, getJobStatusColor } from '@/lib/utils';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import {
  Clock,
  DollarSign,
  Film,
  Download,
  Copy,
  Eye,
  Settings,
  Terminal,
  Loader2,
} from 'lucide-react';

interface JobDetailsModalProps {
  job: JobDetails;
  open: boolean;
  onClose: () => void;
}

export function JobDetailsModal({ job, open, onClose }: JobDetailsModalProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const { toast } = useToast();

  const handleDownload = async () => {
    setIsDownloading(true);
    
    try {
      const response = await api.downloadJobVideo(job.id);
      
      if (response instanceof Response) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `visionweave-${job.title || job.id.slice(0, 8)}.mp4`;
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
      setIsDownloading(false);
    }
  };

  const handleCopyPrompt = () => {
    if (job.prompt) {
      navigator.clipboard.writeText(job.prompt);
      toast({
        variant: "default",
        title: "Copied to clipboard",
        description: "Prompt has been copied",
      });
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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <Film className="w-5 h-5" />
                {job.title || `Job ${job.id.slice(0, 8)}`}
              </DialogTitle>
              <DialogDescription>
                Created {formatTimestamp(job.created_at)}
              </DialogDescription>
            </div>
            
            <div className="flex items-center gap-2">
              <Badge variant={getStatusVariant(job.status)}>
                {job.status}
              </Badge>
              {job.status === 'completed' && (
                <Button
                  onClick={handleDownload}
                  disabled={isDownloading}
                  variant="gold"
                  size="sm"
                >
                  {isDownloading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Downloading...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="overview" className="mt-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="logs" className="flex items-center gap-2">
              <Terminal className="w-4 h-4" />
              Logs
            </TabsTrigger>
            <TabsTrigger value="config" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Config
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Progress */}
            {job.status === 'processing' && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Progress</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <Progress value={job.progress || 0} className="h-3" />
                    <div className="flex justify-between text-sm">
                      <span>Processing video segments...</span>
                      <span>{Math.round(job.progress || 0)}%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Job Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Job Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="font-medium text-muted-foreground">Job ID</div>
                      <div className="font-mono">{job.id.slice(0, 16)}...</div>
                    </div>
                    <div>
                      <div className="font-medium text-muted-foreground">Status</div>
                      <div className={getJobStatusColor(job.status)}>{job.status}</div>
                    </div>
                    <div>
                      <div className="font-medium text-muted-foreground">Created</div>
                      <div>{formatTimestamp(job.created_at)}</div>
                    </div>
                    <div>
                      <div className="font-medium text-muted-foreground">Updated</div>
                      <div>{formatTimestamp(job.updated_at)}</div>
                    </div>
                  </div>

                  {job.duration && (
                    <div>
                      <div className="font-medium text-muted-foreground text-sm">Duration</div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span>{formatDuration(job.duration)}</span>
                      </div>
                    </div>
                  )}

                  {job.estimated_cost && (
                    <div>
                      <div className="font-medium text-muted-foreground text-sm">Estimated Cost</div>
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-muted-foreground" />
                        <span>{formatCurrency(job.estimated_cost)}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center justify-between">
                    Prompt
                    {job.prompt && (
                      <Button
                        onClick={handleCopyPrompt}
                        variant="ghost"
                        size="sm"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {job.prompt ? (
                    <p className="text-sm whitespace-pre-wrap bg-muted/50 rounded-md p-3">
                      {job.prompt}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No prompt available
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Error Message */}
            {job.status === 'failed' && job.error_message && (
              <Card className="border-red-500/20 bg-red-500/5">
                <CardHeader>
                  <CardTitle className="text-lg text-red-400">Error Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm font-mono bg-background/50 rounded-md p-3">
                    {job.error_message}
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="logs" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Job Logs</CardTitle>
              </CardHeader>
              <CardContent>
                {job.logs && job.logs.length > 0 ? (
                  <div className="bg-black/50 rounded-md p-4 font-mono text-sm max-h-96 overflow-y-auto">
                    {job.logs.map((log, index) => (
                      <div key={index} className="text-green-400 mb-1">
                        {log}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No logs available</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="config" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Job Configuration</CardTitle>
              </CardHeader>
              <CardContent>
                {job.config && Object.keys(job.config).length > 0 ? (
                  <div className="bg-muted/50 rounded-md p-4">
                    <pre className="text-sm overflow-x-auto">
                      {JSON.stringify(job.config, null, 2)}
                    </pre>
                  </div>
                ) : (
                  <p className="text-muted-foreground">No configuration data available</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
