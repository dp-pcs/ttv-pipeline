
'use client';

import { useEffect, useState } from 'react';
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
import { formatTimestamp, getJobStatusColor } from '@/lib/utils';
import { GenerationResult, getJobResult, gcsUriToStoragePath } from '@/lib/api-v2';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import type { DisplayJob } from './dashboard';
import {
  DollarSign,
  Film,
  Download,
  Copy,
  Eye,
  Settings,
  AlertTriangle,
  Loader2,
} from 'lucide-react';

interface JobDetailsModalProps {
  job: DisplayJob;
  open: boolean;
  onClose: () => void;
}

export function JobDetailsModal({ job, open, onClose }: JobDetailsModalProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    setResult(null);
    if (job.result_id) {
      getJobResult(job.id).then(setResult).catch((error) => {
        console.error('Failed to fetch job result:', error);
      });
    }
  }, [job.id, job.result_id]);

  const handleDownload = async () => {
    setIsDownloading(true);

    try {
      const current = result ?? (await getJobResult(job.id));
      const asset = current.preview_assets[0] ?? current.scenes.flatMap((s) => s.clips)[0]?.asset;
      const path = asset ? gcsUriToStoragePath(asset.uri) : null;
      if (!path) throw new Error('No downloadable asset found for this job yet');
      const response = await api.downloadFromStorage(path);

      if (response instanceof Response) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `visionweave-${job.title || job.id.slice(0, 8)}${current.result_kind === 'keyframes' ? '.zip' : '.mp4'}`;
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
      case 'finished': return 'success';
      case 'started':
      case 'progress': return 'processing';
      case 'queued': return 'pending';
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
              {job.status === 'finished' && (
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
            <TabsTrigger value="warnings" className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Warnings
            </TabsTrigger>
            <TabsTrigger value="config" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Raw Data
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Progress */}
            {(job.status === 'progress' || job.status === 'started') && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Progress</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <Progress value={job.progress || 0} className="h-3" />
                    <div className="flex justify-between text-sm">
                      <span>{job.current_scene_id ? `Scene ${job.current_scene_id}` : 'Processing...'}</span>
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
                      <div className="font-medium text-muted-foreground">Started</div>
                      <div>{job.started_at ? formatTimestamp(job.started_at) : '—'}</div>
                    </div>
                    <div>
                      <div className="font-medium text-muted-foreground">Finished</div>
                      <div>{job.finished_at ? formatTimestamp(job.finished_at) : '—'}</div>
                    </div>
                  </div>

                  {result && (
                    <div>
                      <div className="font-medium text-muted-foreground text-sm">Result</div>
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-muted-foreground" />
                        <span>{result.terminal_status} ({result.result_kind})</span>
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
          </TabsContent>

          <TabsContent value="warnings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Job Warnings</CardTitle>
              </CardHeader>
              <CardContent>
                {job.warnings && job.warnings.length > 0 ? (
                  <div className="space-y-2">
                    {job.warnings.map((warning, index) => (
                      <div key={index} className="text-sm bg-yellow-500/10 border border-yellow-500/30 rounded-md p-3 text-yellow-200">
                        {warning}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No warnings</p>
                )}
                {result?.scenes.some((s) => s.warnings.length > 0) && (
                  <div className="mt-4 space-y-2">
                    {result.scenes.flatMap((s) => s.warnings.map((w, i) => (
                      <div key={`${s.scene_id}-${i}`} className="text-sm bg-red-500/10 border border-red-500/30 rounded-md p-3 text-red-200">
                        {s.scene_id}: {w}
                      </div>
                    )))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="config" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Raw Job Document</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-muted/50 rounded-md p-4">
                  <pre className="text-sm overflow-x-auto">
                    {JSON.stringify(job, null, 2)}
                  </pre>
                </div>
              </CardContent>
            </Card>
            {result && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Generation Result</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted/50 rounded-md p-4">
                    <pre className="text-sm overflow-x-auto">
                      {JSON.stringify(result, null, 2)}
                    </pre>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
