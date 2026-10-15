'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface StorageFile {
  name: string;
  full_path: string;
  gcs_uri: string;
  size: number;
  size_formatted: string;
  created: string | null;
  updated: string | null;
  content_type: string;
  is_video: boolean;
}

interface BrowseResult {
  bucket: string;
  current_path: string;
  folders: string[];
  files: StorageFile[];
  total_files: number;
  total_folders: number;
}

interface BucketInfo {
  name: string;
  location: string;
  storage_class: string;
  created: string | null;
  updated: string | null;
}

const mono: React.CSSProperties = {
  fontFamily: 'var(--font-mono, JetBrains Mono, monospace)',
};

function fmtDate(s: string | null): string {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return s.slice(0, 16).replace('T', ' ');
  }
}

export function StorageBrowser() {
  const [browseResult, setBrowseResult] = useState<BrowseResult | null>(null);
  const [bucketInfo, setBucketInfo] = useState<BucketInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPath, setCurrentPath] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [downloadingPaths, setDownloadingPaths] = useState<Set<string>>(new Set());
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<StorageFile | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchBucketInfo();
    browsePath('');
  }, []);

  const fetchBucketInfo = async () => {
    try {
      const data = await api.getStorageInfo();
      setBucketInfo(data);
    } catch (error) {
      console.error('Failed to fetch bucket info:', error);
    }
  };

  const browsePath = async (path: string) => {
    setIsLoading(true);
    try {
      const data = await api.browseStorage(path);
      setBrowseResult(data);
      setCurrentPath(path);
      setSelectedFile(null);
    } catch (error) {
      console.error('Failed to browse storage:', error);
      toast({ variant: 'destructive', title: 'Failed to browse storage', description: 'Unable to load bucket contents' });
    } finally {
      setIsLoading(false);
    }
  };

  const navigateToFolder = (folderName: string) => {
    const newPath = currentPath ? `${currentPath}/${folderName}` : folderName;
    browsePath(newPath);
  };

  const navigateUp = () => {
    if (!currentPath) return;
    const parts = currentPath.split('/');
    parts.pop();
    browsePath(parts.join('/'));
  };

  const handleDownload = async (file: StorageFile) => {
    setDownloadingPaths(prev => new Set(prev).add(file.full_path));
    try {
      const response = await api.downloadFromStorage(file.full_path);
      if (response instanceof Response) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        toast({ variant: 'default', title: 'Download Started', description: `Downloading ${file.name}` });
      }
    } catch (error) {
      console.error('Download failed:', error);
      toast({ variant: 'destructive', title: 'Download Failed', description: 'Unable to download file' });
    } finally {
      setDownloadingPaths(prev => {
        const s = new Set(prev);
        s.delete(file.full_path);
        return s;
      });
    }
  };

  const handleStream = (file: StorageFile) => {
    const streamUrl = api.streamFromStorage(file.full_path);
    setPreviewUrl(streamUrl);
  };

  const closePreview = () => setPreviewUrl(null);

  const filteredFiles = browseResult?.files.filter(f =>
    !searchQuery || f.name.toLowerCase().includes(searchQuery.toLowerCase())
  ) ?? [];

  const filteredFolders = browseResult?.folders.filter(f =>
    !searchQuery || f.toLowerCase().includes(searchQuery.toLowerCase())
  ) ?? [];

  const pathParts = currentPath ? currentPath.split('/') : [];

  const previewLabel = (f: StorageFile) => {
    if (f.is_video || f.content_type.startsWith('video/')) return 'video · stream preview';
    if (f.content_type.startsWith('image/')) return 'image preview';
    return '{ json }';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      {/* Video preview modal */}
      {previewUrl && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
          onClick={closePreview}
        >
          <div style={{ position: 'relative', maxWidth: '900px', width: '100%' }} onClick={e => e.stopPropagation()}>
            <button
              onClick={closePreview}
              style={{ position: 'absolute', top: '-32px', right: 0, background: 'transparent', border: 'none', color: 'var(--c-muted)', cursor: 'pointer', ...mono, fontSize: '12px' }}
            >
              Close ✕
            </button>
            <video src={previewUrl} controls autoPlay style={{ width: '100%', borderRadius: '6px' }} />
          </div>
        </div>
      )}

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', padding: '20px 28px 16px', borderBottom: '1px solid var(--c-border)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ ...mono, fontSize: '11px', letterSpacing: '.06em', color: 'var(--c-muted)' }}>
            08 · GET /storage/browse · /storage/info
          </div>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 600, letterSpacing: '-0.01em' }}>Storage</h1>
        </div>
        {bucketInfo && (
          <div style={{ display: 'flex', gap: '22px', ...mono, fontSize: '11px', color: 'var(--c-muted)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span>bucket</span>
              <span style={{ color: 'var(--c-text)' }}>{bucketInfo.name}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span>location</span>
              <span style={{ color: 'var(--c-text)' }}>{bucketInfo.location}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span>storage_class</span>
              <span style={{ color: 'var(--c-text)' }}>{bucketInfo.storage_class}</span>
            </div>
          </div>
        )}
      </div>

      {/* Breadcrumb + search bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '10px 28px', borderBottom: '1px solid var(--c-border)', ...mono, fontSize: '12px' }}>
        <span
          onClick={() => browsePath('')}
          style={{ color: pathParts.length ? 'var(--c-dim)' : 'var(--c-text)', cursor: 'pointer' }}
        >
          gs://{browseResult?.bucket ?? '…'}
        </span>
        {pathParts.map((part, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ color: 'var(--c-dim)' }}>/</span>
            <span
              onClick={() => browsePath(pathParts.slice(0, i + 1).join('/'))}
              style={{ color: i === pathParts.length - 1 ? 'var(--c-text)' : 'var(--c-dim)', cursor: 'pointer' }}
            >
              {part}
            </span>
          </span>
        ))}
        <div style={{ flex: 1 }} />
        <input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="filter…"
          style={{ background: 'transparent', border: '1px solid var(--c-border2)', borderRadius: '3px', color: 'var(--c-text)', padding: '4px 8px', width: '180px', outline: 'none', ...mono, fontSize: '11px' }}
        />
      </div>

      {/* Body */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* File list */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Table header */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 90px 150px', padding: '8px 28px', ...mono, fontSize: '10px', letterSpacing: '.05em', color: 'var(--c-dim)', borderBottom: '1px solid var(--c-border)' }}>
            <span>NAME</span>
            <span style={{ textAlign: 'right' }}>SIZE</span>
            <span style={{ textAlign: 'right' }}>UPDATED</span>
          </div>

          {isLoading && !browseResult && (
            <div style={{ padding: '40px 28px', color: 'var(--c-dim)', ...mono, fontSize: '12px' }}>Loading…</div>
          )}

          {/* Parent dir row */}
          {currentPath && (
            <div
              onClick={navigateUp}
              style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 90px 150px', padding: '9px 28px', borderBottom: '1px solid var(--c-border)', cursor: 'pointer', ...mono, fontSize: '12px' }}
            >
              <span style={{ display: 'flex', gap: '10px', alignItems: 'center', color: 'var(--c-dim)' }}>
                <span style={{ width: '8px', height: '8px', border: '1px solid var(--c-dim)', borderRadius: '1px', flexShrink: 0 }} />
                ..
              </span>
              <span />
              <span />
            </div>
          )}

          {/* Folders */}
          {filteredFolders.map(folder => (
            <div
              key={folder}
              onClick={() => navigateToFolder(folder)}
              style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 90px 150px', padding: '9px 28px', borderBottom: '1px solid #1A1F25', cursor: 'pointer', ...mono, fontSize: '12px' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#13171B')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{ display: 'flex', gap: '10px', alignItems: 'center', color: 'var(--c-text)', minWidth: 0 }}>
                <span style={{ width: '8px', height: '8px', border: '1px solid var(--c-muted)', borderRadius: '1px', flexShrink: 0 }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{folder}/</span>
              </span>
              <span style={{ textAlign: 'right', color: 'var(--c-muted)' }}>—</span>
              <span style={{ textAlign: 'right', color: 'var(--c-muted)' }}>—</span>
            </div>
          ))}

          {/* Files */}
          {filteredFiles.map(file => {
            const isSelected = selectedFile?.full_path === file.full_path;
            const iconFill = file.is_video || file.content_type.startsWith('video/') ? 'var(--c-accent)' : '#3A434E';
            const iconBorder = file.is_video || file.content_type.startsWith('video/') ? 'var(--c-accent)' : 'var(--c-muted)';
            return (
              <div
                key={file.full_path}
                onClick={() => setSelectedFile(file)}
                style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 90px 150px', padding: '9px 28px', borderBottom: '1px solid #1A1F25', cursor: 'pointer', background: isSelected ? '#161A1F' : 'transparent', ...mono, fontSize: '12px' }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#13171B'; }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ display: 'flex', gap: '10px', alignItems: 'center', color: 'var(--c-text)', minWidth: 0 }}>
                  <span style={{ width: '8px', height: '8px', border: `1px solid ${iconBorder}`, background: iconFill, borderRadius: '1px', flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
                </span>
                <span style={{ textAlign: 'right', color: 'var(--c-muted)' }}>{file.size_formatted}</span>
                <span style={{ textAlign: 'right', color: 'var(--c-muted)' }}>{fmtDate(file.updated)}</span>
              </div>
            );
          })}

          {filteredFolders.length === 0 && filteredFiles.length === 0 && !isLoading && (
            <div style={{ padding: '40px 28px', color: 'var(--c-dim)', ...mono, fontSize: '12px' }}>
              {searchQuery ? 'No matching files.' : 'This folder is empty.'}
            </div>
          )}
        </div>

        {/* Right detail panel */}
        <div style={{ width: '260px', flexShrink: 0, borderLeft: '1px solid var(--c-border)', background: 'var(--c-sidebar)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {!selectedFile ? (
            <div style={{ fontSize: '13px', color: 'var(--c-muted)' }}>Select a file to inspect.</div>
          ) : (
            <>
              {/* Preview */}
              <div style={{
                aspectRatio: '16/9',
                background: 'repeating-linear-gradient(135deg, #13171B 0 8px, #171C21 8px 16px)',
                border: '1px solid var(--c-border)',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                ...mono,
                fontSize: '11px',
                color: 'var(--c-dim)',
              }}>
                {previewLabel(selectedFile)}
              </div>

              {/* Path */}
              <div style={{ ...mono, fontSize: '12px', wordBreak: 'break-all' }}>{selectedFile.full_path}</div>

              {/* Key-value */}
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '5px 12px', ...mono, fontSize: '11px' }}>
                <span style={{ color: 'var(--c-dim)' }}>size</span>
                <span>{selectedFile.size_formatted}</span>
                <span style={{ color: 'var(--c-dim)' }}>type</span>
                <span>{selectedFile.content_type}</span>
                <span style={{ color: 'var(--c-dim)' }}>updated</span>
                <span>{fmtDate(selectedFile.updated)}</span>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '8px' }}>
                {(selectedFile.is_video || selectedFile.content_type.startsWith('video/')) && (
                  <button
                    onClick={() => handleStream(selectedFile)}
                    style={{ flex: 1, background: 'transparent', border: '1px solid var(--c-border2)', color: 'var(--c-text)', padding: '8px', borderRadius: '4px', fontSize: '12.5px', cursor: 'pointer' }}
                  >
                    Stream
                  </button>
                )}
                <button
                  onClick={() => handleDownload(selectedFile)}
                  disabled={downloadingPaths.has(selectedFile.full_path)}
                  style={{ flex: 1, background: 'var(--c-accent)', border: 'none', color: '#17110A', padding: '8px', borderRadius: '4px', fontSize: '12.5px', fontWeight: 600, cursor: downloadingPaths.has(selectedFile.full_path) ? 'default' : 'pointer', opacity: downloadingPaths.has(selectedFile.full_path) ? 0.6 : 1 }}
                >
                  {downloadingPaths.has(selectedFile.full_path) ? '…' : 'Download'}
                </button>
              </div>

              {/* Footer note */}
              <div style={{ ...mono, fontSize: '10.5px', color: 'var(--c-dim)', lineHeight: 1.5 }}>
                /storage/stream redirects to a 1h inline signed URL. /storage/download sends the file through the API so the signed URL is never exposed.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
