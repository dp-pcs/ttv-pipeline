
'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { TranscriptionResult } from '@/lib/types';
import { formatDuration, formatFileSize } from '@/lib/utils';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import {
  Mic,
  Upload,
  Download,
  Copy,
  FileAudio,
  FileVideo,
  Loader2,
  CheckCircle,
  AlertCircle,
  Volume2,
  Clock,
  Type,
  X
} from 'lucide-react';

const SUPPORTED_FORMATS = [
  'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/m4a', 'audio/flac',
  'video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo'
];

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

type TranscriptionStep = 'upload' | 'processing' | 'completed' | 'error';

export function Transcription() {
  const [step, setStep] = useState<TranscriptionStep>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<TranscriptionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [outputFormat, setOutputFormat] = useState<'srt' | 'text'>('srt');
  const { toast } = useToast();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelection(files[0]);
    }
  }, []);

  const handleFileSelection = (file: File) => {
    if (!SUPPORTED_FORMATS.includes(file.type)) {
      toast({
        variant: "destructive",
        title: "Unsupported File Format",
        description: "Please select an audio or video file (MP3, WAV, MP4, etc.)",
      });
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      toast({
        variant: "destructive",
        title: "File Too Large",
        description: `File size must be less than ${formatFileSize(MAX_FILE_SIZE)}`,
      });
      return;
    }

    setSelectedFile(file);
    setStep('upload');
    setError(null);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelection(file);
    }
  };

  const startTranscription = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setStep('processing');
    setProgress(0);
    setError(null);

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 500);

      const transcriptionResult = await api.uploadForTranscription(selectedFile);
      
      clearInterval(progressInterval);
      setProgress(100);
      
      setResult(transcriptionResult);
      setStep('completed');
      
      toast({
        variant: "default",
        title: "Transcription Complete",
        description: "Your audio has been successfully transcribed",
      });
    } catch (error) {
      console.error('Transcription failed:', error);
      setError(error instanceof Error ? error.message : 'Transcription failed');
      setStep('error');
      
      toast({
        variant: "destructive",
        title: "Transcription Failed",
        description: "Unable to process your audio file",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      variant: "default",
      title: "Copied to Clipboard",
      description: "Content has been copied to your clipboard",
    });
  };

  const handleDownload = async () => {
    if (!result) return;

    try {
      const content = outputFormat === 'srt' ? result.srt_content : result.plain_text;
      const filename = `transcription-${Date.now()}.${outputFormat === 'srt' ? 'srt' : 'txt'}`;
      
      const response = await api.downloadTranscription(content, filename);
      
      if (response instanceof Response) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        toast({
          variant: "default",
          title: "Download Started",
          description: "Transcription file is being downloaded",
        });
      }
    } catch (error) {
      console.error('Download failed:', error);
      toast({
        variant: "destructive",
        title: "Download Failed",
        description: "Unable to download transcription file",
      });
    }
  };

  const reset = () => {
    setStep('upload');
    setSelectedFile(null);
    setResult(null);
    setError(null);
    setProgress(0);
    setIsProcessing(false);
  };

  const getFileIcon = (file: File) => {
    return file.type.startsWith('audio/') ? FileAudio : FileVideo;
  };

  return (
    <div className="min-h-screen bg-background page-transition">
      <div className="max-w-4xl mx-auto py-12 px-4 space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold">
            <span className="metallic-gradient">Audio Transcription</span>
          </h1>
          <p className="text-xl text-muted-foreground">
            Convert your audio and video files to accurate text transcriptions
          </p>
        </div>

        {/* Upload Section */}
        {step === 'upload' && (
          <Card className="animate-fade-in">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mic className="w-5 h-5" />
                Upload Media File
              </CardTitle>
              <CardDescription>
                Drag and drop or select an audio/video file to transcribe
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* File Drop Zone */}
              <div
                className={`border-2 border-dashed rounded-lg p-12 text-center transition-all duration-200 cursor-pointer hover:border-primary/50 hover:bg-accent/20 ${
                  isDragOver ? 'border-primary bg-accent/30' : 'border-muted-foreground/25'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => document.getElementById('file-input')?.click()}
              >
                <div className="space-y-4">
                  <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center">
                    <Upload className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Drop your file here</h3>
                    <p className="text-muted-foreground">
                      or click to browse files
                    </p>
                  </div>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>Supports: MP3, WAV, MP4, MOV, AVI, M4A, FLAC</p>
                    <p>Maximum file size: {formatFileSize(MAX_FILE_SIZE)}</p>
                  </div>
                </div>
                <input
                  id="file-input"
                  type="file"
                  accept="audio/*,video/*"
                  onChange={handleFileInput}
                  className="hidden"
                />
              </div>

              {/* Selected File */}
              {selectedFile && (
                <Card className="border-metallic-gold/20 bg-metallic-gold/5">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-lg bg-background/50">
                        {(() => {
                          const FileIcon = getFileIcon(selectedFile);
                          return <FileIcon className="w-6 h-6 text-metallic-gold" />;
                        })()}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium">{selectedFile.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {formatFileSize(selectedFile.size)} • {selectedFile.type}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedFile(null)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Action Buttons */}
              <div className="flex justify-between items-center">
                <div className="text-sm text-muted-foreground">
                  Powered by OpenAI Whisper
                </div>
                <Button
                  onClick={startTranscription}
                  disabled={!selectedFile || isProcessing}
                  variant="gold"
                  size="lg"
                >
                  <Volume2 className="w-4 h-4 mr-2" />
                  Start Transcription
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Processing Section */}
        {step === 'processing' && (
          <Card className="animate-fade-in">
            <CardContent className="p-8 text-center space-y-6">
              <div className="w-16 h-16 mx-auto rounded-full bg-blue-500/10 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Processing Audio</h3>
                <p className="text-muted-foreground">
                  Analyzing and transcribing your file...
                </p>
              </div>
              <div className="max-w-md mx-auto space-y-2">
                <Progress value={progress} className="h-3" />
                <div className="text-sm text-muted-foreground">
                  {progress}% complete
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Results Section */}
        {step === 'completed' && result && (
          <Card className="animate-fade-in">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                    Transcription Complete
                  </CardTitle>
                  <CardDescription>
                    Your audio has been successfully transcribed
                  </CardDescription>
                </div>
                <Button onClick={reset} variant="outline">
                  New Transcription
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* File Info */}
              {selectedFile && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <FileAudio className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{selectedFile.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{formatDuration(result.duration)}</span>
                  </div>
                  {result.language && (
                    <div className="flex items-center gap-2">
                      <Type className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">{result.language}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Format Toggle */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Output Format:</span>
                  <div className="flex items-center gap-1 bg-muted rounded-md p-1">
                    <Button
                      variant={outputFormat === 'srt' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setOutputFormat('srt')}
                    >
                      SRT
                    </Button>
                    <Button
                      variant={outputFormat === 'text' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setOutputFormat('text')}
                    >
                      Plain Text
                    </Button>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => handleCopyToClipboard(
                      outputFormat === 'srt' ? result.srt_content : result.plain_text
                    )}
                    variant="outline"
                    size="sm"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy
                  </Button>
                  <Button
                    onClick={handleDownload}
                    variant="gold"
                    size="sm"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                </div>
              </div>

              {/* Transcription Output */}
              <Card className="bg-background/50 border-muted-foreground/20">
                <CardContent className="p-4">
                  <Textarea
                    value={outputFormat === 'srt' ? result.srt_content : result.plain_text}
                    readOnly
                    className="min-h-[300px] font-mono text-sm resize-none border-0 bg-transparent"
                  />
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        )}

        {/* Error Section */}
        {step === 'error' && (
          <Card className="animate-fade-in border-red-500/20 bg-red-500/5">
            <CardContent className="p-8 text-center space-y-6">
              <div className="w-16 h-16 mx-auto rounded-full bg-red-500/10 flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-red-400" />
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2 text-red-400">
                  Transcription Failed
                </h3>
                <p className="text-muted-foreground">
                  {error || 'An error occurred during transcription'}
                </p>
              </div>
              <Button onClick={reset} variant="outline">
                Try Again
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
