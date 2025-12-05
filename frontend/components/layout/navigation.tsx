
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { 
  Home, 
  Settings, 
  Download, 
  Mic, 
  Activity,
  Menu,
  X,
  Cloud
} from 'lucide-react';

const navigationItems = [
  {
    name: 'Dashboard',
    href: '/',
    icon: Home,
    description: 'Generate videos from prompts'
  },
  {
    name: 'Transcription',
    href: '/transcription',
    icon: Mic,
    description: 'Extract audio to text'
  },
  {
    name: 'Downloads',
    href: '/downloads',
    icon: Download,
    description: 'Manage your generated content'
  },
  {
    name: 'Storage',
    href: '/storage',
    icon: Cloud,
    description: 'Browse cloud storage'
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: Settings,
    description: 'Configure your preferences'
  },
];

export function Navigation() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <>
      <nav className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-40 items-center justify-between">
            {/* Logo */}
            <Link href="/" className="flex items-center space-x-6 group">
              <div className="relative w-32 h-32 rounded-2xl overflow-hidden bg-black shadow-2xl border-2 border-gray-500">
                <Image
                  src="/assets/visionweave_logo.png"
                  alt="VisionWeave Logo"
                  fill
                  className="object-contain group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <span className="hidden sm:block text-4xl font-bold metallic-gradient">
                VisionWeave
              </span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      "flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 hover:bg-accent/50",
                      isActive 
                        ? "text-foreground bg-accent metallic-glow" 
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </div>

            {/* API Status Indicator */}
            <div className="hidden md:flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-xs">
                <Activity className="w-4 h-4 text-green-400" />
                <span className="text-muted-foreground">API Ready</span>
              </div>
            </div>

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden"
              onClick={toggleMobileMenu}
            >
              {isMobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-border/40 bg-background/95 backdrop-blur">
            <div className="max-w-screen-xl mx-auto px-4 py-4 space-y-2">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={toggleMobileMenu}
                    className={cn(
                      "flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200",
                      isActive 
                        ? "text-foreground bg-accent metallic-glow" 
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    <div>
                      <div>{item.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {item.description}
                      </div>
                    </div>
                  </Link>
                );
              })}
              
              {/* Mobile API Status */}
              <div className="flex items-center space-x-3 px-4 py-3 border-t border-border/40 mt-4 pt-4">
                <Activity className="w-5 h-5 text-green-400" />
                <div>
                  <div className="text-sm font-medium">API Status</div>
                  <div className="text-xs text-green-400">Connected</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </nav>
    </>
  );
}
