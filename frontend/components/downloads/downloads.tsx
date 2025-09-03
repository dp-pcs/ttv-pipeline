
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { JobStatus } from '@/lib/types';
import { formatTimestamp, formatCurrency, cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { 
  Download,
  Search,
  Calendar,
  Filter,
  Play,
  Eye,
  Trash2,
  Loader2,
  Grid3X3,
  List,
  ChevronDown,
  FileVideo,
  Clock
} from 'lucide-react';

type ViewMode = 'grid' | 'list';
type FilterStatus = 'all' | 'completed' | 'failed';
type SortBy = 'newest' | 'oldest' | 'title';

export function Downloads() {
  const [jobs, setJobs] = useState<JobStatus[]>([]);
  const [filteredJobs, setFilteredJobs] = useState<JobStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [sortBy, setSortBy] = useState<SortBy>('newest');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  useEffect(() => {
    fetchJobs();
  }, []);

  useEffect(() => {
    filterAndSortJobs();
  }, [jobs, searchQuery, filterStatus, sortBy]);

  const fetchJobs = async () => {
    setIsLoading(true);
    try {
      const jobsData = await api.getJobs();
      // Filter to only show completed and failed jobs for downloads page
      const downloadableJobs = jobsData?.filter(job => 
        job.status === 'completed' || job.status === 'failed'
      ) || [];
      setJobs(downloadableJobs);
    } catch (error) {
      console.error('Failed to fetch jobs:', error);
      toast({
        variant: "destructive",
        title: "Failed to load downloads",
        description: "Unable to fetch your video library",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filterAndSortJobs = () => {
    let filtered = [...jobs];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(job => 
        (job.title?.toLowerCase().includes(query)) ||
        (job.prompt?.toLowerCase().includes(query)) ||
        job.id.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(job => job.status === filterStatus);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'title':
          const aTitle = a.title || `Video ${a.id.slice(0, 8)}`;
          const bTitle = b.title || `Video ${b.id.slice(0, 8)}`;
          return aTitle.localeCompare(bTitle);
        default:
          return 0;
      }
    });

    setFilteredJobs(filtered);
  };

  const handleDownload = async (jobId: string) => {
    setDownloadingIds(prev => new Set(prev.add(jobId)));
    
    try {
      const response = await api.downloadJobVideo(jobId);
      
      if (response instanceof Response) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        const job = jobs.find(j => j.id === jobId);
        a.href = url;
        a.download = `visionweave-${job?.title || jobId.slice(0, 8)}.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        toast({
          variant: "default",
          title: "Download Started",
          description: "Your video is being downloaded",
        });
      }
    } catch (error) {
      console.error('Download failed:', error);
      toast({
        variant: "destructive",
        title: "Download Failed",
        description: "Unable to download video file",
      });
    } finally {
      setDownloadingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(jobId);
        return newSet;
      });
    }
  };

  const handleDelete = async (jobId: string) => {
    if (!confirm('Are you sure you want to delete this video? This action cannot be undone.')) {
      return;
    }

    try {
      await api.deleteJob(jobId);
      setJobs(prev => prev.filter(job => job.id !== jobId));
      toast({
        variant: "default",
        title: "Video Deleted",
        description: "Video has been removed from your library",
      });
    } catch (error) {
      console.error('Delete failed:', error);
      toast({
        variant: "destructive",
        title: "Delete Failed",
        description: "Unable to delete video",
      });
    }
  };

  const completedJobs = jobs.filter(job => job.status === 'completed');
  const failedJobs = jobs.filter(job => job.status === 'failed');

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading your video library...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background page-transition">
      <div className="max-w-screen-xl mx-auto py-12 px-4 space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold">
            <span className="metallic-gradient">Downloads</span>
          </h1>
          <p className="text-xl text-muted-foreground">
            Manage and download your generated videos
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 animate-fade-in">
          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-2xl font-bold text-green-400">{completedJobs.length}</div>
              <div className="text-sm text-muted-foreground">Completed Videos</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-2xl font-bold text-red-400">{failedJobs.length}</div>
              <div className="text-sm text-muted-foreground">Failed Generations</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-2xl font-bold metallic-gradient">{jobs.length}</div>
              <div className="text-sm text-muted-foreground">Total Items</div>
            </CardContent>
          </Card>
        </div>

        {/* Controls */}
        <Card className="animate-fade-in">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="flex flex-col sm:flex-row gap-4 flex-1">
                {/* Search */}
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="Search videos..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {/* Filters */}
                <div className="flex gap-2">
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
                    className="px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="all">All Status</option>
                    <option value="completed">Completed</option>
                    <option value="failed">Failed</option>
                  </select>

                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortBy)}
                    className="px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                    <option value="title">By Title</option>
                  </select>
                </div>
              </div>

              {/* View Mode Toggle */}
              <div className="flex items-center gap-1 bg-muted rounded-md p-1">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                >
                  <Grid3X3 className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                >
                  <List className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {filteredJobs.length === 0 ? (
          <Card className="animate-fade-in">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Download className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No videos found</h3>
              <p className="text-muted-foreground">
                {searchQuery ? 'Try adjusting your search or filters' : 'Generate some videos to see them here'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className={cn(
            "animate-fade-in",
            viewMode === 'grid' 
              ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              : "space-y-4"
          )}>
            {filteredJobs.map((job) => (
              <Card key={job.id} className="transition-all duration-200 hover:shadow-lg hover:metallic-glow">
                <CardContent className="p-6">
                  {viewMode === 'grid' ? (
                    <div className="space-y-4">
                      <div className="aspect-video bg-muted rounded-md flex items-center justify-center">
                        <FileVideo className="w-12 h-12 text-muted-foreground" />
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-semibold truncate">
                            {job.title || `Video ${job.id.slice(0, 8)}`}
                          </h3>
                          <Badge variant={job.status === 'completed' ? 'success' : 'destructive'}>
                            {job.status}
                          </Badge>
                        </div>
                        
                        {job.prompt && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {job.prompt}
                          </p>
                        )}
                        
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {formatTimestamp(job.created_at)}
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        {job.status === 'completed' && (
                          <Button
                            onClick={() => handleDownload(job.id)}
                            disabled={downloadingIds.has(job.id)}
                            variant="gold"
                            size="sm"
                            className="flex-1"
                          >
                            {downloadingIds.has(job.id) ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Download className="w-4 h-4" />
                            )}
                          </Button>
                        )}
                        
                        <Button
                          onClick={() => handleDelete(job.id)}
                          variant="ghost"
                          size="sm"
                          className="text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-4">
                      <div className="w-20 h-12 bg-muted rounded flex items-center justify-center flex-shrink-0">
                        <FileVideo className="w-6 h-6 text-muted-foreground" />
                      </div>
                      
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold truncate">
                            {job.title || `Video ${job.id.slice(0, 8)}`}
                          </h3>
                          <Badge variant={job.status === 'completed' ? 'success' : 'destructive'}>
                            {job.status}
                          </Badge>
                        </div>
                        
                        <div className="text-sm text-muted-foreground">
                          {formatTimestamp(job.created_at)}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {job.status === 'completed' && (
                          <Button
                            onClick={() => handleDownload(job.id)}
                            disabled={downloadingIds.has(job.id)}
                            variant="gold"
                            size="sm"
                          >
                            {downloadingIds.has(job.id) ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Download className="w-4 h-4" />
                            )}
                          </Button>
                        )}
                        
                        <Button
                          onClick={() => handleDelete(job.id)}
                          variant="ghost"
                          size="sm"
                          className="text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
