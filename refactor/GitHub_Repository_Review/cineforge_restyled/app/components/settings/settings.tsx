
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AppSettings, ApiStatus } from '@/lib/types';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { 
  Settings as SettingsIcon, 
  Key, 
  Cloud, 
  DollarSign,
  Server,
  Save,
  TestTube,
  Loader2,
  CheckCircle,
  XCircle
} from 'lucide-react';

const DEFAULT_SETTINGS: AppSettings = {
  openai_api_key: '',
  google_project_id: '',
  backend_selection: 'minimax',
  budget_cap: 10.0,
  api_base_url: 'http://localhost:8000',
};

export function Settings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [apiStatus, setApiStatus] = useState<ApiStatus | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadSettings();
    testConnection();
  }, []);

  const loadSettings = () => {
    try {
      const savedSettings = localStorage.getItem('cineforge_settings');
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = () => {
    setIsSaving(true);
    try {
      localStorage.setItem('cineforge_settings', JSON.stringify(settings));
      toast({
        variant: "default",
        title: "Settings Saved",
        description: "Your preferences have been saved successfully",
      });
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast({
        variant: "destructive",
        title: "Save Failed",
        description: "Unable to save settings",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const testConnection = async () => {
    setIsTesting(true);
    try {
      const status = await api.getReadinessStatus();
      setApiStatus(status);
      
      const allHealthy = Object.values(status).every(Boolean);
      toast({
        variant: allHealthy ? "default" : "warning",
        title: allHealthy ? "Connection Successful" : "Partial Connection",
        description: allHealthy 
          ? "All services are operational" 
          : "Some services may be unavailable",
      });
    } catch (error) {
      console.error('Connection test failed:', error);
      setApiStatus({
        api: false,
        worker: false,
        redis: false,
        gcs: false,
      });
      toast({
        variant: "destructive",
        title: "Connection Failed",
        description: "Unable to reach CineForge API",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSettingChange = (key: keyof AppSettings, value: string | number) => {
    setSettings(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading settings...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background page-transition">
      <div className="max-w-4xl mx-auto py-12 px-4 space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold">
            <span className="metallic-gradient">Settings</span>
          </h1>
          <p className="text-xl text-muted-foreground">
            Configure your CineForge preferences and API settings
          </p>
        </div>

        {/* API Status */}
        <Card className="animate-fade-in">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="w-5 h-5" />
              Connection Status
            </CardTitle>
            <CardDescription>
              Current status of CineForge services
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { key: 'api', label: 'API', icon: Server },
                  { key: 'worker', label: 'Workers', icon: Cloud },
                  { key: 'redis', label: 'Queue', icon: Server },
                  { key: 'gcs', label: 'Storage', icon: Cloud },
                ].map((service) => {
                  const isHealthy = apiStatus?.[service.key as keyof ApiStatus] ?? false;
                  const Icon = service.icon;
                  
                  return (
                    <div key={service.key} className="flex items-center gap-2">
                      <Icon className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">{service.label}</span>
                      {isHealthy ? (
                        <CheckCircle className="w-4 h-4 text-green-400" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-400" />
                      )}
                    </div>
                  );
                })}
              </div>
              
              <Button
                onClick={testConnection}
                disabled={isTesting}
                variant="outline"
                size="sm"
              >
                {isTesting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <TestTube className="w-4 h-4 mr-2" />
                    Test Connection
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* API Configuration */}
        <Card className="animate-fade-in">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              API Configuration
            </CardTitle>
            <CardDescription>
              Configure API endpoints and authentication
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="api_base_url">API Base URL</Label>
                <Input
                  id="api_base_url"
                  placeholder="http://localhost:8000"
                  value={settings.api_base_url}
                  onChange={(e) => handleSettingChange('api_base_url', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="google_project_id">
                  Google Project ID
                  <Badge variant="outline" className="ml-2 text-xs">Optional</Badge>
                </Label>
                <Input
                  id="google_project_id"
                  placeholder="your-gcp-project-id"
                  value={settings.google_project_id}
                  onChange={(e) => handleSettingChange('google_project_id', e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="openai_api_key">
                OpenAI API Key
                <Badge variant="outline" className="ml-2 text-xs">For Transcription</Badge>
              </Label>
              <Input
                id="openai_api_key"
                type="password"
                placeholder="sk-..."
                value={settings.openai_api_key}
                onChange={(e) => handleSettingChange('openai_api_key', e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Generation Settings */}
        <Card className="animate-fade-in">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SettingsIcon className="w-5 h-5" />
              Generation Settings
            </CardTitle>
            <CardDescription>
              Control video generation behavior and costs
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="backend_selection">Video Generation Backend</Label>
                <Select
                  value={settings.backend_selection}
                  onValueChange={(value: 'google_veo' | 'runway' | 'minimax') => 
                    handleSettingChange('backend_selection', value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select backend" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="minimax">
                      MiniMax (Recommended)
                    </SelectItem>
                    <SelectItem value="runway">
                      Runway ML
                    </SelectItem>
                    <SelectItem value="google_veo">
                      Google Veo
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="budget_cap" className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Budget Cap per Video
                </Label>
                <Input
                  id="budget_cap"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max="100"
                  placeholder="10.00"
                  value={settings.budget_cap}
                  onChange={(e) => handleSettingChange('budget_cap', parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h4 className="font-medium text-sm">Backend Information</h4>
              <div className="text-xs text-muted-foreground space-y-1">
                <p><strong>MiniMax:</strong> Fast processing, good quality, competitive pricing</p>
                <p><strong>Runway ML:</strong> High quality, slower processing, higher cost</p>
                <p><strong>Google Veo:</strong> Experimental, variable quality and speed</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <Card className="animate-fade-in">
          <CardContent className="pt-6">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="font-medium">Save Configuration</h4>
                <p className="text-sm text-muted-foreground">
                  Settings are stored locally in your browser
                </p>
              </div>
              
              <Button
                onClick={saveSettings}
                disabled={isSaving}
                variant="gold"
                size="lg"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Settings
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
