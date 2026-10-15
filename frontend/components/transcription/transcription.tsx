'use client';

import { useState, useCallback } from 'react';
import { TranscriptionResult } from '@/lib/types';
import { formatDuration, formatFileSize } from '@/lib/utils';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

const SUPPORTED_FORMATS = [
  'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/m4a', 'audio/flac',
  'video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo',
];
const MAX_FILE_SIZE = 25 * 1024 * 1024;
type Step = 'upload' | 'processing' | 'completed' | 'error';

interface SrtCue { n: number; t: string; text: string; }

function parseSrt(srt: string): SrtCue[] {
  const cues: SrtCue[] = [];
  const blocks = srt.trim().split(/\n\n+/);
  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 2) continue;
    const n = parseInt(lines[0], 10);
    const t = lines[1] ?? '';
    const text = lines.slice(2).join(' ');
    if (!isNaN(n) && t.includes('-->')) cues.push({ n, t, text });
  }
  return cues;
}

const mono: React.CSSProperties = { fontFamily: 'var(--font-mono, JetBrains Mono, monospace)' };

export function Transcription() {
  const [step, setStep] = useState<Step>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<TranscriptionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragOver(false); }, []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) handleFileSelection(files[0]);
  }, []);

  const handleFileSelection = (file: File) => {
    if (!SUPPORTED_FORMATS.includes(file.type)) {
      toast({ variant: 'destructive', title: 'Unsupported File Format', description: 'Please select an audio or video file (MP3, WAV, MP4, etc.)' });
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast({ variant: 'destructive', title: 'File Too Large', description: `File size must be less than ${formatFileSize(MAX_FILE_SIZE)}` });
      return;
    }
    setSelectedFile(file);
    setStep('upload');
    setError(null);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelection(file);
  };

  const startTranscription = async () => {
    if (!selectedFile) return;
    setIsProcessing(true);
    setStep('processing');
    setProgress(0);
    setError(null);
    try {
      const interval = setInterval(() => setProgress(p => p >= 90 ? (clearInterval(interval), 90) : p + 10), 500);
      const res = await api.uploadForTranscription(selectedFile);
      clearInterval(interval);
      setProgress(100);
      setResult(res);
      setStep('completed');
      toast({ variant: 'default', title: 'Transcription Complete', description: 'Your audio has been successfully transcribed' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transcription failed');
      setStep('error');
      toast({ variant: 'destructive', title: 'Transcription Failed', description: 'Unable to process your audio file' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = async () => {
    if (!result) return;
    try {
      const content = result.srt_content;
      const filename = `transcription-${Date.now()}.srt`;
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
        toast({ variant: 'default', title: 'Download Started', description: 'Transcription file is being downloaded' });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Download Failed', description: 'Unable to download transcription file' });
    }
  };

  const reset = () => { setStep('upload'); setSelectedFile(null); setResult(null); setError(null); setProgress(0); setIsProcessing(false); };

  const cues = result?.srt_content ? parseSrt(result.srt_content) : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', padding: '20px 28px 16px', borderBottom: '1px solid var(--c-border)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ ...mono, fontSize: '11px', letterSpacing: '.06em', color: 'var(--c-muted)' }}>
            09 · POST /transcription/upload · whisper-1
          </div>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 600, letterSpacing: '-0.01em' }}>Transcribe</h1>
        </div>
        {step === 'completed' && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={reset}
              style={{ background: 'transparent', border: '1px solid var(--c-border2)', color: 'var(--c-text)', padding: '8px 12px', borderRadius: '4px', fontSize: '13px', cursor: 'pointer' }}
            >
              New file
            </button>
            <button
              onClick={handleDownload}
              style={{ background: 'var(--c-accent)', border: 'none', color: '#17110A', padding: '9px 14px', borderRadius: '4px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
            >
              Download .srt
            </button>
          </div>
        )}
      </div>

      {/* idle / upload step */}
      {(step === 'upload') && (
        <div style={{ padding: '28px' }}>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => document.getElementById('tx-file-input')?.click()}
            style={{
              border: `1.5px dashed ${isDragOver ? 'var(--c-accent)' : 'var(--c-border2)'}`,
              borderRadius: '8px',
              padding: '56px 24px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '10px',
              cursor: 'pointer',
              textAlign: 'center',
              transition: 'border-color 0.15s',
            }}
          >
            <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--c-text)' }}>
              {selectedFile ? selectedFile.name : 'Drop an audio file, or click to choose'}
            </div>
            <div style={{ ...mono, fontSize: '11.5px', color: 'var(--c-muted)' }}>
              mp3 · mp4 · wav · m4a · flac · ogg · webm — max 25 MB
            </div>
            <div style={{ fontSize: '12.5px', color: 'var(--c-dim)' }}>
              Returns SRT with timestamps and a plain-text version.
            </div>
            {selectedFile && (
              <button
                onClick={e => { e.stopPropagation(); startTranscription(); }}
                disabled={isProcessing}
                style={{ marginTop: '8px', background: 'var(--c-accent)', border: 'none', color: '#17110A', padding: '9px 18px', borderRadius: '4px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
              >
                Start transcription
              </button>
            )}
          </div>
          <input id="tx-file-input" type="file" accept="audio/*,video/*" onChange={handleFileInput} style={{ display: 'none' }} />
        </div>
      )}

      {/* processing step */}
      {step === 'processing' && (
        <div style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '640px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', ...mono, fontSize: '12px' }}>
            <span>{selectedFile?.name ?? ''} · {formatFileSize(selectedFile?.size ?? 0)}</span>
            <span style={{ color: 'var(--c-run)' }}>transcribing</span>
          </div>
          <div style={{ height: '4px', background: '#1A1F25', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: 'var(--c-run)', transition: 'width 0.3s' }} />
          </div>
        </div>
      )}

      {/* completed step */}
      {step === 'completed' && result && (
        <>
          {/* meta bar */}
          <div style={{ padding: '12px 28px', borderBottom: '1px solid var(--c-border)', display: 'flex', gap: '22px', ...mono, fontSize: '11.5px', color: 'var(--c-muted)', flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--c-text)' }}>{selectedFile?.name}</span>
            {selectedFile && <span>{formatFileSize(selectedFile.size)}</span>}
            <span>{cues.length} cues</span>
            {result.duration != null && <span>{formatDuration(result.duration)}</span>}
            {result.language && <span>language: {result.language}</span>}
          </div>

          {/* two-column content */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', flex: 1, minHeight: 0 }}>
            {/* SRT column */}
            <div style={{ display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--c-border)' }}>
              <div style={{ padding: '9px 28px', ...mono, fontSize: '11px', color: 'var(--c-muted)', borderBottom: '1px solid var(--c-border)' }}>srt_content</div>
              <div style={{ overflowY: 'auto' }}>
                {cues.map(cue => (
                  <div key={cue.n} style={{ display: 'grid', gridTemplateColumns: '28px 210px minmax(0,1fr)', gap: '10px', padding: '8px 28px', borderBottom: '1px solid #1A1F25', fontSize: '13.5px' }}>
                    <span style={{ ...mono, fontSize: '11px', color: 'var(--c-dim)' }}>{cue.n}</span>
                    <span style={{ ...mono, fontSize: '11px', color: 'var(--c-accent)' }}>{cue.t}</span>
                    <span>{cue.text}</span>
                  </div>
                ))}
                {cues.length === 0 && (
                  <pre style={{ margin: 0, padding: '16px 28px', ...mono, fontSize: '11px', color: 'var(--c-muted)', whiteSpace: 'pre-wrap' }}>{result.srt_content}</pre>
                )}
              </div>
            </div>

            {/* Plain text column */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '9px 28px', ...mono, fontSize: '11px', color: 'var(--c-muted)', borderBottom: '1px solid var(--c-border)' }}>plain_text</div>
              <div style={{ padding: '16px 28px', fontSize: '15px', lineHeight: 1.65, maxWidth: '62ch' }}>{result.plain_text}</div>
              {/* Note: POST /transcription/download reads result.filename and result.text, which don't exist on TranscriptionResponse. This UI builds the .srt from srt_content on the client until that's fixed. */}
              <div style={{ padding: '0 28px', ...mono, fontSize: '10.5px', color: 'var(--c-warn)', lineHeight: 1.5 }}>
                Note: POST /transcription/download reads result.filename and result.text, which don't exist on TranscriptionResponse. This UI builds the .srt from srt_content on the client until that's fixed.
              </div>
            </div>
          </div>
        </>
      )}

      {/* error step */}
      {step === 'error' && (
        <div style={{ margin: '60px auto', maxWidth: '420px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
          <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--c-fail)' }}>Transcription Failed</div>
          <div style={{ color: 'var(--c-muted)', fontSize: '13.5px' }}>{error ?? 'An error occurred during transcription.'}</div>
          <button onClick={reset} style={{ background: 'transparent', border: '1px solid var(--c-border2)', color: 'var(--c-text)', padding: '8px 14px', borderRadius: '4px', fontSize: '13px', cursor: 'pointer' }}>Try again</button>
        </div>
      )}
    </div>
  );
}
