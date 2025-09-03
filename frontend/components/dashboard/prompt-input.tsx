
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { JobEstimate } from '@/lib/types';
import { api } from '@/lib/api';
import { formatCurrency, validatePrompt } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, 
  Sparkles, 
  DollarSign, 
  Clock, 
  Film,
  AlertCircle 
} from 'lucide-react';

interface PromptInputProps {
  onJobCreated: (jobId: string) => void;
}

export function PromptInput({ onJobCreated }: PromptInputProps) {
  const [prompt, setPrompt] = useState('');
  const [title, setTitle] = useState('');
  const [estimate, setEstimate] = useState<JobEstimate | null>(null);
  const [isEstimating, setIsEstimating] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [errors, setErrors] = useState<{ prompt?: string; title?: string }>({});
  const { toast } = useToast();

  const handleEstimate = async () => {
    const validation = validatePrompt(prompt);
    if (!validation.valid) {
      setErrors({ prompt: validation.message });
      return;
    }

    setErrors({});
    setIsEstimating(true);
    setEstimate(null);

    try {
      const estimateData = await api.estimateJob(prompt, title);
      setEstimate(estimateData);
      setShowConfirmation(true);
    } catch (error) {
      console.error('Estimation failed:', error);
      toast({
        variant: "destructive",
        title: "Estimation Failed",
        description: "Unable to estimate job cost. Please try again.",
      });
    } finally {
      setIsEstimating(false);
    }
  };

  const handleCreateJob = async () => {
    if (!estimate) return;

    setIsCreating(true);
    
    try {
      const result = await api.createJob(prompt, title);
      onJobCreated(result.job_id);
      
      // Reset form
      setPrompt('');
      setTitle('');
      setEstimate(null);
      setShowConfirmation(false);
      
    } catch (error) {
      console.error('Job creation failed:', error);
      toast({
        variant: "destructive",
        title: "Job Creation Failed", 
        description: "Unable to create video generation job. Please try again.",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleCancel = () => {
    setShowConfirmation(false);
    setEstimate(null);
  };

  if (showConfirmation && estimate) {
    return (
      <Card className="border-metallic-gold/20 bg-metallic-gold/5 animate-fade-in">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-metallic-gold flex-shrink-0 mt-0.5" />
            <div className="space-y-3 flex-1">
              <h3 className="font-semibold text-metallic-gold">Confirm Video Generation</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Film className="w-4 h-4 text-muted-foreground" />
                  <span>{estimate.segments} segments</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span>{estimate.duration}s duration</span>
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-muted-foreground" />
                  <span>{formatCurrency(estimate.cost)}</span>
                </div>
              </div>

              <div className="bg-background/50 rounded-lg p-3 space-y-2">
                <div className="text-sm font-medium">Video Details:</div>
                {title && (
                  <div className="text-sm text-muted-foreground">
                    <strong>Title:</strong> {title}
                  </div>
                )}
                <div className="text-sm text-muted-foreground">
                  <strong>Prompt:</strong> {prompt}
                </div>
              </div>

              <div className="flex gap-3">
                <Button 
                  onClick={handleCreateJob}
                  disabled={isCreating}
                  variant="gold"
                  className="flex-1"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Generate Video
                    </>
                  )}
                </Button>
                <Button 
                  onClick={handleCancel}
                  variant="outline"
                  disabled={isCreating}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="title" className="text-sm font-medium">
            Title <span className="text-muted-foreground">(optional)</span>
          </label>
          <Input
            id="title"
            placeholder="Give your video a memorable name..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="transition-all duration-200 focus:scale-[1.01]"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="prompt" className="text-sm font-medium">
            Video Prompt <span className="text-red-400">*</span>
          </label>
          <Textarea
            id="prompt"
            placeholder="Describe the video you want to create in detail. Be specific about scenes, actions, style, and mood..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            className={`transition-all duration-200 focus:scale-[1.01] ${
              errors.prompt ? 'border-red-500 focus:border-red-500' : ''
            }`}
          />
          {errors.prompt && (
            <p className="text-sm text-red-400">{errors.prompt}</p>
          )}
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Minimum 10 characters</span>
            <span>{prompt.length}/1000</span>
          </div>
        </div>
      </div>

      <Separator className="my-6" />

      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <DollarSign className="w-4 h-4" />
          <span>Cost estimation required before generation</span>
        </div>
        
        <Button
          onClick={handleEstimate}
          disabled={!prompt.trim() || isEstimating}
          variant="metallic"
          className="w-full"
          size="lg"
        >
          {isEstimating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Calculating Cost...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Get Cost Estimate
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
