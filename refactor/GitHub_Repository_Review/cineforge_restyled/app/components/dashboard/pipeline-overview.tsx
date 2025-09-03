
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { ArrowRight, Type, Zap, Film, Download } from 'lucide-react';

const pipelineSteps = [
  {
    icon: Type,
    title: 'Text Prompt',
    description: 'AI analyzes your creative description',
    color: 'text-blue-400',
    bgColor: 'bg-blue-400/10',
    borderColor: 'border-blue-400/20',
  },
  {
    icon: Zap,
    title: 'Keyframe Generation', 
    description: 'Creates visual keyframes for scenes',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-400/10',
    borderColor: 'border-yellow-400/20',
  },
  {
    icon: Film,
    title: 'Frame Interpolation',
    description: 'Generates smooth transitions between frames',
    color: 'text-purple-400',
    bgColor: 'bg-purple-400/10',
    borderColor: 'border-purple-400/20',
  },
  {
    icon: Download,
    title: 'Video Encoding',
    description: 'Outputs high-quality MP4 video',
    color: 'text-green-400',
    bgColor: 'bg-green-400/10',
    borderColor: 'border-green-400/20',
  },
];

export function PipelineOverview() {
  return (
    <Card className="animate-fade-in">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🔥 How CineForge Works
        </CardTitle>
        <CardDescription>
          Our advanced AI pipeline transforms your ideas into cinematic videos
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-8">
          {/* Pipeline Diagram */}
          <div className="relative w-full h-48 rounded-lg overflow-hidden bg-gradient-to-br from-background/50 to-muted/50 border border-border">
            <Image
              src="https://cdn.abacus.ai/images/6124d7ec-f494-485d-a7d9-968bcc53677f.png"
              alt="CineForge Pipeline Process"
              fill
              className="object-contain p-4"
            />
          </div>

          {/* Process Steps */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {pipelineSteps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div key={step.title} className="relative">
                  {/* Arrow between steps */}
                  {index < pipelineSteps.length - 1 && (
                    <div className="hidden lg:block absolute -right-8 top-1/2 -translate-y-1/2 z-10">
                      <ArrowRight className="w-6 h-6 text-muted-foreground" />
                    </div>
                  )}
                  
                  <Card className={`transition-all duration-200 hover:scale-105 ${step.borderColor} ${step.bgColor}`}>
                    <CardContent className="p-4 text-center space-y-3">
                      <div className={`w-12 h-12 rounded-full ${step.bgColor} ${step.borderColor} border flex items-center justify-center mx-auto`}>
                        <Icon className={`w-6 h-6 ${step.color}`} />
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm">{step.title}</h4>
                        <p className="text-xs text-muted-foreground mt-1">
                          {step.description}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        Step {index + 1}
                      </Badge>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>

          {/* Tech Specs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-border/40">
            <div className="text-center">
              <div className="text-lg font-bold metallic-gradient">4K</div>
              <div className="text-xs text-muted-foreground">Resolution</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold metallic-gradient">30fps</div>
              <div className="text-xs text-muted-foreground">Frame Rate</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold metallic-gradient">MP4</div>
              <div className="text-xs text-muted-foreground">Format</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold metallic-gradient">H.264</div>
              <div className="text-xs text-muted-foreground">Codec</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
