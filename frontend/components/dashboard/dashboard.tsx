
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PromptInput } from './prompt-input';
import { JobQueue } from './job-queue';
import { PipelineOverview } from './pipeline-overview';
import { ApiStatusCard } from './api-status-card';
import { JobStatus } from '@/lib/types';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

export function Dashboard() {
  const [jobs, setJobs] = useState<JobStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchJobs = async () => {
    try {
      const jobsData = await api.getJobs();
      setJobs(jobsData || []);
    } catch (error) {
      console.error('Failed to fetch jobs:', error);
      toast({
        variant: "destructive",
        title: "Failed to load jobs",
        description: "Unable to connect to the VisionWeave API",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
    
    // Poll for job updates every 5 seconds
    const interval = setInterval(fetchJobs, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const handleJobCreated = (jobId: string) => {
    // Refresh jobs list after new job creation
    fetchJobs();
    
    toast({
      variant: "default",
      title: "Job Created",
      description: `Video generation job ${jobId.slice(0, 8)}... has been queued`,
    });
  };

  const handleJobDeleted = (jobId: string) => {
    setJobs(prev => prev.filter(job => job.id !== jobId));
    
    toast({
      variant: "default", 
      title: "Job Deleted",
      description: "Job has been removed from the queue",
    });
  };

  return (
    <div className="min-h-screen bg-background page-transition">
      {/* Hero Section */}
      <section className="py-12 px-4">
        <div className="max-w-screen-xl mx-auto text-center">
          <h1 className="text-4xl sm:text-6xl font-bold mb-6">
            Transform <span className="metallic-gradient">Ideas</span> into{' '}
            <span className="metallic-gradient">Videos</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
            Generate stunning videos from text prompts using AI-powered keyframe generation 
            and seamless video stitching technology.
          </p>
        </div>
      </section>

      <div className="max-w-screen-xl mx-auto px-4 pb-12 space-y-8">
        {/* API Status */}
        <ApiStatusCard />
        
        {/* Pipeline Overview */}
        <PipelineOverview />
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Prompt Input Section */}
          <div className="space-y-6">
            <Card className="animate-fade-in">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  ✨ Create Video
                </CardTitle>
                <CardDescription>
                  Enter your creative prompt to generate a unique video
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PromptInput onJobCreated={handleJobCreated} />
              </CardContent>
            </Card>
          </div>

          {/* Job Queue Section */}
          <div className="space-y-6">
            <Card className="animate-fade-in">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  🎬 Job Queue
                  {jobs.length > 0 && (
                    <span className="text-sm font-normal text-muted-foreground">
                      ({jobs.length} {jobs.length === 1 ? 'job' : 'jobs'})
                    </span>
                  )}
                </CardTitle>
                <CardDescription>
                  Monitor your video generation progress
                </CardDescription>
              </CardHeader>
              <CardContent>
                <JobQueue 
                  jobs={jobs} 
                  onJobDeleted={handleJobDeleted}
                  isLoading={isLoading}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
