'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { formatTimestamp, cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { 
  Download,
  Folder,
  FolderOpen,
  FileVideo,
  FileImage,
  File,
  ChevronRight,
  Home,
  Loader2,
  RefreshCw,
  Search,
  Play,
  ArrowLeft,
  Cloud,
  HardDrive
} from 'lucide-react';

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

export function StorageBrowser() {
  const [browseResult, setBrowseResult] = useState<BrowseResult | null>(null);
  const [bucketInfo, setBucketInfo] = useState<BucketInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPath, setCurrentPath] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [downloadingPaths, setDownloadingPaths] = useState<Set<string>>(new Set());
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchBucketInfo();
    browsePath('');
  }, []);

  const fetchBucketInfo = async () => {
    try {
      const response = await fetch('http://localhost:8000/storage/info');
      if (response.ok) {
        const data = await response.json();
        setBucketInfo(data);
      }
    } catch (error) {
      console.error('Failed to fetch bucket info:', error);
    }
  };

  const browsePath = async (path: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`http://localhost:8000/storage/browse?path=${encodeURIComponent(path)}`);
      if (!response.ok) {
        throw new Error('Failed to browse storage');
      }
      const data = await response.json();
      setBrowseResult(data);
      setCurrentPath(path);
    } catch (error) {
      console.error('Failed to browse storage:', error);
      toast({
        variant: "destructive",
        title: "Failed to browse storage",
        description: "Unable to load bucket contents",
      });
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

  const navigateToRoot = () => {
    browsePath('');
  };

  const handleDownload = async (file: StorageFile) => {
    setDownloadingPaths(prev => new Set(prev.add(file.full_path)));
    
    try {
      const response = await fetch(
        `http://localhost:8000/storage/download?path=${encodeURIComponent(file.full_path)}`
      );
      
      if (!response.ok) {
        throw new Error('Download failed');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast({
        variant: "default",
        title: "Download Started",
        description: `Downloading ${file.name}`,
      });
    } catch (error) {
      console.error('Download failed:', error);
      toast({
        variant: "destructive",
        title: "Download Failed",
        description: "Unable to download file",
      });
    } finally {
      setDownloadingPaths(prev => {
        const newSet = new Set(prev);
        newSet.delete(file.full_path);
        return newSet;
      });
    }
  };

  const handlePreview = (file: StorageFile) => {
    const streamUrl = `http://localhost:8000/storage/stream?path=${encodeURIComponent(file.full_path)}`;
    setPreviewUrl(streamUrl);
  };

  const closePreview = () => {
    setPreviewUrl(null);
  };

  const getFileIcon = (file: StorageFile) => {
    if (file.is_video || file.content_type.startsWith('video/')) {
      return <FileVideo className="w-5 h-5 text-blue-400" />;
    }
    if (file.content_type.startsWith('image/')) {
      return <FileImage className="w-5 h-5 text-green-400" />;
    }
    return <File className="w-5 h-5 text-gray-400" />;
  };

  const filteredFiles = browseResult?.files.filter(file => 
    !searchQuery || file.name.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const filteredFolders = browseResult?.folders.filter(folder =>
    !searchQuery || folder.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const pathParts = currentPath ? currentPath.split('/') : [];

  if (isLoading && !browseResult) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading storage...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background page-transition">
      {/* Video Preview Modal */}
      {previewUrl && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={closePreview}
        >
          <div 
            className="relative max-w-4xl w-full"
            onClick={e => e.stopPropagation()}
          >
            <Button
              variant="ghost"
              size="sm"
              className="absolute -top-10 right-0 text-white"
              onClick={closePreview}
            >
              Close
            </Button>
            <video 
              src={previewUrl} 
              controls 
              autoPlay
              className="w-full rounded-lg"
            />
          </div>
        </div>
      )}

      <div className="max-w-screen-xl mx-auto py-12 px-4 space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold">
            <span className="metallic-gradient">Storage Browser</span>
          </h1>
          <p className="text-xl text-muted-foreground">
            Browse and download files from your cloud storage
          </p>
        </div>

        {/* Bucket Info Card */}
        {bucketInfo && (
          <Card className="animate-fade-in">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-muted rounded-lg">
                  <Cloud className="w-6 h-6 text-blue-400" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">{bucketInfo.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {bucketInfo.location} • {bucketInfo.storage_class}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold metallic-gradient">
                    {browseResult?.total_files || 0}
                  </div>
                  <div className="text-sm text-muted-foreground">files in view</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Navigation & Search */}
        <Card className="animate-fade-in">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Breadcrumb Navigation */}
              <div className="flex items-center gap-1 flex-1 overflow-x-auto">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={navigateToRoot}
                  className="flex-shrink-0"
                >
                  <Home className="w-4 h-4" />
                </Button>
                
                {pathParts.map((part, index) => (
                  <div key={index} className="flex items-center">
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const newPath = pathParts.slice(0, index + 1).join('/');
                        browsePath(newPath);
                      }}
                      className="flex-shrink-0"
                    >
                      {part}
                    </Button>
                  </div>
                ))}
              </div>

              {/* Search & Refresh */}
              <div className="flex gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="Filter..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 w-48"
                  />
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => browsePath(currentPath)}
                  disabled={isLoading}
                >
                  <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Content */}
        <Card className="animate-fade-in">
          <CardContent className="p-0">
            {/* Back Button */}
            {currentPath && (
              <div 
                className="flex items-center gap-3 p-4 border-b hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={navigateUp}
              >
                <ArrowLeft className="w-5 h-5 text-muted-foreground" />
                <span className="text-muted-foreground">..</span>
              </div>
            )}

            {/* Folders */}
            {filteredFolders.map((folder) => (
              <div
                key={folder}
                className="flex items-center gap-3 p-4 border-b hover:bg-muted/50 cursor-pointer transition-colors group"
                onClick={() => navigateToFolder(folder)}
              >
                <Folder className="w-5 h-5 text-amber-400 group-hover:hidden" />
                <FolderOpen className="w-5 h-5 text-amber-400 hidden group-hover:block" />
                <span className="flex-1 font-medium">{folder}</span>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
            ))}

            {/* Files */}
            {filteredFiles.map((file) => (
              <div
                key={file.full_path}
                className="flex items-center gap-3 p-4 border-b hover:bg-muted/50 transition-colors"
              >
                {getFileIcon(file)}
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{file.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {file.size_formatted}
                    {file.updated && ` • ${formatTimestamp(file.updated)}`}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {file.is_video && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handlePreview(file)}
                    >
                      <Play className="w-4 h-4" />
                    </Button>
                  )}
                  <Button
                    variant="gold"
                    size="sm"
                    onClick={() => handleDownload(file)}
                    disabled={downloadingPaths.has(file.full_path)}
                  >
                    {downloadingPaths.has(file.full_path) ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            ))}

            {/* Empty State */}
            {filteredFolders.length === 0 && filteredFiles.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <HardDrive className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">
                  {searchQuery ? 'No matching files' : 'This folder is empty'}
                </h3>
                <p className="text-muted-foreground">
                  {searchQuery ? 'Try a different search term' : 'Upload some files to see them here'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stats Footer */}
        <div className="text-center text-sm text-muted-foreground">
          {browseResult && (
            <span>
              Showing {filteredFolders.length} folder{filteredFolders.length !== 1 ? 's' : ''} and {filteredFiles.length} file{filteredFiles.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

