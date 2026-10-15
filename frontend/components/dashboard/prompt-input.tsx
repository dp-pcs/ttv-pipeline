
'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  CapabilitiesResponse,
  GenerationPlan,
  buildSingleSceneRequest,
  createPlan,
  buildApproval,
  approvePlan,
  getCapabilities,
  getDeliveryOptions,
  planNeedsUnknownCostAck,
  resolveDelivery,
  ApiV2Error,
} from '@/lib/api-v2';
import { addTrackedJob } from '@/lib/job-tracker';
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
  ChevronUp,
  ImageIcon,
} from 'lucide-react';

interface PromptInputProps {
  onJobCreated: (jobId: string) => void;
}

export function PromptInput({ onJobCreated }: PromptInputProps) {
  const [prompt, setPrompt] = useState('');
  const [title, setTitle] = useState('');
  const [styleInstructions, setStyleInstructions] = useState('');
  const [showStyleField, setShowStyleField] = useState(false);
  const [errors, setErrors] = useState<{ prompt?: string }>({});
  const { toast } = useToast();

  // Capability-driven provider/duration/resolution controls (Phase 1's
  // GET /v2/capabilities — real, live providers only, no hardcoded list).
  const [capabilities, setCapabilities] = useState<CapabilitiesResponse | null>(null);
  const [capabilitiesError, setCapabilitiesError] = useState<string | null>(null);
  const [provider, setProvider] = useState<string>('');
  const [duration, setDuration] = useState<number>(0);
  const [deliveryOption, setDeliveryOption] = useState<string>('');
  const [keyframesOnly, setKeyframesOnly] = useState(false);

  useEffect(() => {
    getCapabilities()
      .then((caps) => {
        setCapabilities(caps);
        const firstProvider = caps.providers[0]?.provider;
        if (!firstProvider) {
          setCapabilitiesError('No video generation backend is currently available.');
          return;
        }
        setProvider(firstProvider);
        setDuration(caps.providers[0].capability_snapshot.allowed_durations_s[0]);
        const options = getDeliveryOptions(caps, firstProvider);
        setDeliveryOption(options[0] || '');
      })
      .catch((error) => {
        console.error('Failed to load capabilities:', error);
        setCapabilitiesError('Unable to reach the video generation API.');
      });
  }, []);

  const handleProviderChange = (next: string) => {
    setProvider(next);
    const providerCaps = capabilities?.providers.find((p) => p.provider === next);
    if (providerCaps) setDuration(providerCaps.capability_snapshot.allowed_durations_s[0]);
    const options = capabilities ? getDeliveryOptions(capabilities, next) : [];
    setDeliveryOption(options[0] || '');
  };

  const [isPlanning, setIsPlanning] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [plan, setPlan] = useState<GenerationPlan | null>(null);
  const [acknowledgedUnknownCost, setAcknowledgedUnknownCost] = useState(false);

  const providerCaps = capabilities?.providers.find((p) => p.provider === provider);
  const deliveryOptions = capabilities ? getDeliveryOptions(capabilities, provider) : [];

  const handlePlan = async () => {
    setErrors({});

    if (!prompt || prompt.trim().length < 10) {
      setErrors({ prompt: 'Prompt must be at least 10 characters long' });
      return;
    }

    const separator = styleInstructions.trim() ? '\n\nStyle & Aesthetic: ' : '';
    const combinedLength = prompt.length + separator.length + styleInstructions.length;
    if (combinedLength > 10000) {
      setErrors({
        prompt: `Combined prompt and style cannot exceed 10,000 characters. Currently: ${combinedLength.toLocaleString()}. Please reduce by ${(combinedLength - 10000).toLocaleString()} characters.`,
      });
      return;
    }

    if (!provider || !duration) {
      toast({ variant: 'destructive', title: 'Not ready', description: 'Video generation backend is still loading.' });
      return;
    }

    const fullPrompt = styleInstructions.trim()
      ? `${prompt}\n\nStyle & Aesthetic: ${styleInstructions}`
      : prompt;

    setIsPlanning(true);
    setPlan(null);
    setAcknowledgedUnknownCost(false);

    try {
      const { aspectRatio, targetWidth, targetHeight } = deliveryOption
        ? resolveDelivery(provider, deliveryOption)
        : { aspectRatio: '16:9', targetWidth: 1280, targetHeight: 720 };
      const request = await buildSingleSceneRequest(fullPrompt, {
        provider,
        durationSeconds: duration,
        aspectRatio,
        targetWidth,
        targetHeight,
      });
      const newPlan = await createPlan(request);
      setPlan(newPlan);
    } catch (error) {
      console.error('Plan creation failed:', error);
      const message = error instanceof ApiV2Error ? error.message : 'Unable to estimate job cost. Please try again.';
      toast({ variant: 'destructive', title: 'Estimation Failed', description: message });
    } finally {
      setIsPlanning(false);
    }
  };

  const handleApprove = async () => {
    if (!plan || plan.status !== 'ready') return;
    const scene = plan.scenes[0];
    const variant = scene?.variants[0];
    if (!variant) return;

    setIsApproving(true);
    try {
      const approval = await buildApproval(
        plan,
        [variant.variant_id],
        keyframesOnly ? 'keyframes' : 'video',
        acknowledgedUnknownCost
      );
      const job = await approvePlan(approval);
      addTrackedJob(job.id, { title: title || undefined, prompt });
      onJobCreated(job.id);

      setPrompt('');
      setTitle('');
      setStyleInstructions('');
      setPlan(null);
      setKeyframesOnly(false);
    } catch (error) {
      console.error('Job creation failed:', error);
      const message = error instanceof ApiV2Error ? error.message : 'Unable to create video generation job. Please try again.';
      toast({ variant: 'destructive', title: 'Job Creation Failed', description: message });
    } finally {
      setIsApproving(false);
    }
  };

  const handleCancelConfirmation = () => {
    setPlan(null);
    setAcknowledgedUnknownCost(false);
  };

  if (plan) {
    const scene = plan.scenes[0];
    const variant = scene?.variants[0];
    const cost = variant?.estimated_cost?.amount;
    const needsAck = planNeedsUnknownCostAck(plan);
    const canApprove = plan.status === 'ready' && !!variant && (!needsAck || acknowledgedUnknownCost);

    return (
      <Card className="border-metallic-gold/20 bg-metallic-gold/5 animate-fade-in">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-metallic-gold flex-shrink-0 mt-0.5" />
            <div className="space-y-3 flex-1">
              <h3 className="font-semibold text-metallic-gold">Confirm Video Generation</h3>

              {plan.status === 'blocked' ? (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 space-y-1">
                  <div className="text-sm font-medium text-red-400">This plan can't be generated yet:</div>
                  {plan.blocked_reasons.map((reason, i) => (
                    <div key={i} className="text-sm text-red-300">{reason.message}</div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Film className="w-4 h-4 text-muted-foreground" />
                    <span>{variant?.provider} / {variant?.model}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span>{scene.requested_duration_s}s duration</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-muted-foreground" />
                    <span>{cost != null ? `$${cost.toFixed(2)}` : 'Unknown'}</span>
                  </div>
                </div>
              )}

              {scene?.warnings.length > 0 && (
                <div className="bg-background/50 rounded-lg p-3 space-y-1">
                  {scene.warnings.map((warning, i) => (
                    <div key={i} className="text-sm text-muted-foreground">⚠ {warning}</div>
                  ))}
                </div>
              )}

              {needsAck && (
                <div className="flex items-start gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                  <Checkbox
                    id="ack-unknown-cost"
                    checked={acknowledgedUnknownCost}
                    onCheckedChange={(checked) => setAcknowledgedUnknownCost(checked === true)}
                    className="mt-0.5"
                  />
                  <Label htmlFor="ack-unknown-cost" className="text-sm text-yellow-200 font-normal cursor-pointer">
                    I understand the image-generation cost for this plan can't be estimated in advance and want to proceed anyway.
                  </Label>
                </div>
              )}

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
                  onClick={handleApprove}
                  disabled={isApproving || !canApprove}
                  variant="gold"
                  className="flex-1"
                >
                  {isApproving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      {keyframesOnly ? 'Generate Storyboard' : 'Generate Video'}
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleCancelConfirmation}
                  variant="outline"
                  disabled={isApproving}
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
  const totalAvailable = 10000;
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
                className="transition-all duration-200 focus:scale-[1.01]"
              />
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

      {/* Capability-driven generation settings */}
      <div className="space-y-4">
        {capabilitiesError && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">
            {capabilitiesError}
          </div>
        )}

        {capabilities && capabilities.providers.length > 0 && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="provider-select">Video Generation Backend</Label>
                <Select value={provider} onValueChange={handleProviderChange}>
                  <SelectTrigger id="provider-select">
                    <SelectValue placeholder="Select backend" />
                  </SelectTrigger>
                  <SelectContent>
                    {capabilities.providers.map((p) => (
                      <SelectItem key={p.provider} value={p.provider}>
                        {p.provider} ({p.model})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {deliveryOptions.length > 0 && (
                <div className="space-y-2">
                  <Label>Resolution / Aspect Ratio</Label>
                  <ToggleGroup
                    type="single"
                    value={deliveryOption}
                    onValueChange={(value) => value && setDeliveryOption(value)}
                    className="flex-wrap justify-start"
                  >
                    {deliveryOptions.map((option) => (
                      <ToggleGroupItem key={option} value={option} className="text-xs">
                        {option}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </div>
              )}
            </div>

            {providerCaps && providerCaps.capability_snapshot.allowed_durations_s.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Duration</Label>
                  <span className="text-sm text-muted-foreground">{duration}s</span>
                </div>
                {providerCaps.capability_snapshot.allowed_durations_s.length > 1 ? (
                  <Slider
                    value={[duration]}
                    onValueChange={([value]) => setDuration(value)}
                    min={Math.min(...providerCaps.capability_snapshot.allowed_durations_s)}
                    max={Math.max(...providerCaps.capability_snapshot.allowed_durations_s)}
                    step={1}
                  />
                ) : (
                  <p className="text-xs text-muted-foreground">Fixed at {duration}s for this backend.</p>
                )}
              </div>
            )}

            <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium">Storyboard only</div>
                  <div className="text-xs text-muted-foreground">Generate keyframes without rendering video</div>
                </div>
              </div>
              <Switch checked={keyframesOnly} onCheckedChange={setKeyframesOnly} />
            </div>
          </>
        )}

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <DollarSign className="w-4 h-4" />
          <span>Cost estimation required before generation</span>
        </div>

        <Button
          onClick={handlePlan}
          disabled={!prompt.trim() || isPlanning || !!capabilitiesError || !provider}
          variant="default"
          className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-black font-semibold"
          size="lg"
        >
          {isPlanning ? (
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
