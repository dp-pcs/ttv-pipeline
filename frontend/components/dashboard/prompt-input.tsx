
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
  AlertCircle,
  Palette,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface PromptInputProps {
  onJobCreated: (jobId: string) => void;
}

export function PromptInput({ onJobCreated }: PromptInputProps) {
  const [prompt, setPrompt] = useState('');
  const [title, setTitle] = useState('');
  const [styleInstructions, setStyleInstructions] = useState('');
  const [showStyleField, setShowStyleField] = useState(false);
  const [estimate, setEstimate] = useState<JobEstimate | null>(null);
  const [isEstimating, setIsEstimating] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [errors, setErrors] = useState<{ prompt?: string; title?: string; style?: string }>({});
  const { toast } = useToast();

  const handleEstimate = async () => {
    setErrors({});

    // Validate main prompt has minimum content
    if (!prompt || prompt.trim().length < 10) {
      setErrors({ prompt: 'Prompt must be at least 10 characters long' });
      return;
    }

    // Calculate combined length (this is what backend will see)
    const separator = styleInstructions.trim() ? '\n\nStyle & Aesthetic: ' : '';
    const combinedLength = prompt.length + separator.length + styleInstructions.length;

    // Backend limit is 10000 chars for the combined prompt
    if (combinedLength > 10000) {
      setErrors({
        prompt: `Combined prompt and style cannot exceed 10,000 characters. Currently: ${combinedLength.toLocaleString()}. Please reduce by ${(combinedLength - 10000).toLocaleString()} characters.`
      });
      return;
    }

    // Combine for API call
    const fullPrompt = styleInstructions.trim()
      ? `${prompt}\n\nStyle & Aesthetic: ${styleInstructions}`
      : prompt;

    setIsEstimating(true);
    setEstimate(null);

    try {
      const estimateData = await api.estimateJob(fullPrompt, title);
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
      // Combine prompt and style instructions
      const fullPrompt = styleInstructions.trim()
        ? `${prompt}\n\nStyle & Aesthetic: ${styleInstructions}`
        : prompt;

      const result = await api.createJob(fullPrompt, title);
      onJobCreated(result.job_id);

      // Reset form
      setPrompt('');
      setTitle('');
      setStyleInstructions('');
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
                {styleInstructions && (
                  <div className="text-sm text-muted-foreground border-t border-border/40 pt-2 mt-2">
                    <strong>Style:</strong> {styleInstructions}
                  </div>
                )}
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

  const combinedLength = prompt.length + styleInstructions.length + (styleInstructions.trim() ? 23 : 0); // 23 = length of "\n\nStyle & Aesthetic: "
  const totalAvailable = 10000; // Backend limit for combined prompt
  const percentUsed = (combinedLength / totalAvailable) * 100;

  return (
    <div className="space-y-4">
      {/* Combined Character Counter */}
      {(prompt.length > 0 || styleInstructions.length > 0) && (
        <Card className={`border-2 transition-colors ${
          combinedLength > totalAvailable
            ? 'border-red-500 bg-red-500/5'
            : combinedLength > totalAvailable * 0.9
            ? 'border-yellow-500 bg-yellow-500/5'
            : 'border-metallic-gold/20 bg-metallic-gold/5'
        }`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Combined Character Count (Prompt + Style)</span>
              <span className={`text-sm font-bold ${
                combinedLength > totalAvailable
                  ? 'text-red-400'
                  : combinedLength > totalAvailable * 0.9
                  ? 'text-yellow-400'
                  : 'text-metallic-gold'
              }`}>
                {combinedLength.toLocaleString()} / {totalAvailable.toLocaleString()}
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  combinedLength > totalAvailable
                    ? 'bg-red-500'
                    : combinedLength > totalAvailable * 0.9
                    ? 'bg-yellow-500'
                    : 'bg-gradient-to-r from-amber-500 to-yellow-500'
                }`}
                style={{ width: `${Math.min(percentUsed, 100)}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
              <span>Main: {prompt.length.toLocaleString()}</span>
              {styleInstructions.length > 0 && (
                <span>Style: {styleInstructions.length.toLocaleString()}</span>
              )}
              <span>{(totalAvailable - combinedLength).toLocaleString()} remaining</span>
            </div>
          </CardContent>
        </Card>
      )}

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
            <span>Minimum 10 characters • Combined with style must be ≤ 10,000</span>
            <span>{prompt.length} chars</span>
          </div>
        </div>

        {/* Style Instructions (Optional) */}
        <div className="space-y-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowStyleField(!showStyleField)}
            className="w-full justify-between text-muted-foreground hover:text-foreground"
          >
            <div className="flex items-center gap-2">
              <Palette className="w-4 h-4" />
              <span className="text-sm font-medium">
                Style & Aesthetic Instructions <span className="text-xs">(Optional)</span>
              </span>
            </div>
            {showStyleField ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </Button>

          {showStyleField && (
            <div className="space-y-2 animate-fade-in">
              <Textarea
                id="style"
                placeholder="Describe the visual style, mood, color palette, cinematography, lighting... (e.g., 'Cinematic film noir style, moody lighting, high contrast, muted colors with pops of neon')"
                value={styleInstructions}
                onChange={(e) => setStyleInstructions(e.target.value)}
                rows={3}
                className={`transition-all duration-200 focus:scale-[1.01] ${
                  errors.style ? 'border-red-500 focus:border-red-500' : ''
                }`}
              />
              {errors.style && (
                <p className="text-sm text-red-400">{errors.style}</p>
              )}
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Style + main prompt combined limit: 10,000 chars</span>
                <span>{styleInstructions.length} chars</span>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground">
                <p><strong>Tip:</strong> This field shares the 10,000 character total with the main prompt above. Use it for artistic direction, cinematography, color grading, and visual mood to keep your main prompt focused on the scene itself.</p>
              </div>
            </div>
          )}
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
          variant="default"
          className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-black font-semibold"
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
