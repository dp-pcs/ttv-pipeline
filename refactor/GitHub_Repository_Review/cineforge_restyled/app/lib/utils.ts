
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(amount);
}

export function formatTimestamp(timestamp: string): string {
  return new Date(timestamp).toLocaleString();
}

export function formatFileSize(bytes: number): string {
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${Math.round(bytes / Math.pow(1024, i) * 100) / 100} ${sizes[i]}`;
}

export function generateJobId(): string {
  return Math.random().toString(36).substring(2, 15);
}

export function debounce<T extends (...args: any[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function validatePrompt(prompt: string): { valid: boolean; message?: string } {
  if (!prompt.trim()) {
    return { valid: false, message: 'Prompt cannot be empty' };
  }
  
  if (prompt.length < 10) {
    return { valid: false, message: 'Prompt must be at least 10 characters long' };
  }
  
  if (prompt.length > 1000) {
    return { valid: false, message: 'Prompt cannot exceed 1000 characters' };
  }
  
  return { valid: true };
}

export function getJobStatusColor(status: string): string {
  switch (status) {
    case 'completed':
      return 'text-green-400';
    case 'processing':
      return 'text-blue-400';
    case 'pending':
      return 'text-yellow-400';
    case 'failed':
      return 'text-red-400';
    case 'cancelled':
      return 'text-gray-400';
    default:
      return 'text-gray-400';
  }
}

export function getJobStatusIcon(status: string): string {
  switch (status) {
    case 'completed':
      return 'check-circle';
    case 'processing':
      return 'loader';
    case 'pending':
      return 'clock';
    case 'failed':
      return 'x-circle';
    case 'cancelled':
      return 'ban';
    default:
      return 'help-circle';
  }
}
