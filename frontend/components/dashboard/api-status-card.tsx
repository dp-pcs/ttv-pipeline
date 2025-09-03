
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ApiStatus } from '@/lib/types';
import { api } from '@/lib/api';
import { 
  Activity,
  Server,
  Database,
  Cloud,
  Zap,
  AlertCircle,
  CheckCircle,
  Loader2 
} from 'lucide-react';

const statusServices = [
  {
    key: 'api' as keyof ApiStatus,
    label: 'API Server',
    icon: Server,
    description: 'Core application services',
  },
  {
    key: 'worker' as keyof ApiStatus,
    label: 'Workers',
    icon: Zap,
    description: 'Video processing queue',
  },
  {
    key: 'redis' as keyof ApiStatus,
    label: 'Redis',
    icon: Database,
    description: 'Job queue storage',
  },
  {
    key: 'gcs' as keyof ApiStatus,
    label: 'Storage',
    icon: Cloud,
    description: 'Video file storage',
  },
];

export function ApiStatusCard() {
  const [status, setStatus] = useState<ApiStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  const checkStatus = async () => {
    try {
      const statusData = await api.getReadinessStatus();
      setStatus(statusData);
      setLastCheck(new Date());
    } catch (error) {
      console.error('Failed to fetch API status:', error);
      setStatus({
        api: false,
        worker: false, 
        redis: false,
        gcs: false,
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();
    
    // Check status every 30 seconds
    const interval = setInterval(checkStatus, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const allServicesHealthy = status && Object.values(status).every(Boolean);
  const someServicesDown = status && Object.values(status).some(value => !value);

  const getOverallStatus = () => {
    if (isLoading) return { label: 'Checking...', variant: 'secondary' as const, icon: Loader2 };
    if (allServicesHealthy) return { label: 'All Systems Operational', variant: 'success' as const, icon: CheckCircle };
    if (someServicesDown) return { label: 'Partial Service Disruption', variant: 'warning' as const, icon: AlertCircle };
    return { label: 'Service Unavailable', variant: 'destructive' as const, icon: AlertCircle };
  };

  const overallStatus = getOverallStatus();
  const StatusIcon = overallStatus.icon;

  return (
    <Card className="animate-fade-in">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Activity className="w-5 h-5" />
          System Status
        </CardTitle>
        <div className="flex items-center justify-between">
          <CardDescription>
            Real-time health monitoring of VisionWeave services
          </CardDescription>
          <div className="flex items-center gap-2">
            <StatusIcon className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <Badge variant={overallStatus.variant}>
              {overallStatus.label}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statusServices.map((service) => {
            const Icon = service.icon;
            const isHealthy = status?.[service.key] ?? false;
            
            return (
              <div
                key={service.key}
                className={`rounded-lg border p-4 transition-all duration-200 hover:scale-105 ${
                  isLoading
                    ? 'border-muted bg-muted/20'
                    : isHealthy
                    ? 'border-green-500/20 bg-green-500/5'
                    : 'border-red-500/20 bg-red-500/5'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-md ${
                    isLoading
                      ? 'bg-muted text-muted-foreground'
                      : isHealthy
                      ? 'bg-green-500/10 text-green-400'
                      : 'bg-red-500/10 text-red-400'
                  }`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-sm">{service.label}</h4>
                      {!isLoading && (
                        <div className={`w-2 h-2 rounded-full ${
                          isHealthy ? 'bg-green-400' : 'bg-red-400'
                        }`} />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {service.description}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        
        {lastCheck && (
          <div className="mt-4 pt-4 border-t border-border/40">
            <p className="text-xs text-muted-foreground">
              Last checked: {lastCheck.toLocaleTimeString()}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
