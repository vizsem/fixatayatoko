'use client';

import React from 'react';

interface LoadingFallbackProps {
  type?: 'page' | 'card' | 'table' | 'form' | 'skeleton';
  message?: string;
  className?: string;
}

/**
 * Komponen loading fallback yang reusable untuk berbagai konteks
 */
export function LoadingFallback({ 
  type = 'page', 
  message = 'Memuat...',
  className = '' 
}: LoadingFallbackProps) {
  
  // Page-level loading (full screen atau section besar)
  if (type === 'page') {
    return (
      <div className={`min-h-[60vh] flex flex-col items-center justify-center p-8 ${className}`}>
        <div className="relative">
          {/* Animated spinner */}
          <div className="w-16 h-16 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
          {/* Pulse effect */}
          <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-t-blue-400 rounded-full animate-spin" style={{ animationDuration: '1.5s' }}></div>
        </div>
        <p className="mt-6 text-sm font-bold text-gray-500 uppercase tracking-widest animate-pulse">
          {message}
        </p>
      </div>
    );
  }

  // Card-level loading
  if (type === 'card') {
    return (
      <div className={`bg-white rounded-2xl p-6 shadow-sm border border-gray-100 animate-pulse ${className}`}>
        <div className="space-y-4">
          <div className="h-4 bg-gray-200 rounded-lg w-3/4"></div>
          <div className="h-3 bg-gray-100 rounded-lg w-1/2"></div>
          <div className="h-20 bg-gray-100 rounded-xl w-full mt-4"></div>
          <div className="flex gap-2 mt-4">
            <div className="h-8 bg-gray-200 rounded-lg w-20"></div>
            <div className="h-8 bg-gray-200 rounded-lg w-20"></div>
          </div>
        </div>
      </div>
    );
  }

  // Table loading
  if (type === 'table') {
    return (
      <div className={`bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 ${className}`}>
        <div className="p-6 space-y-4 animate-pulse">
          {/* Header skeleton */}
          <div className="flex gap-4 pb-4 border-b border-gray-100">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-3 bg-gray-200 rounded w-24"></div>
            ))}
          </div>
          {/* Row skeletons */}
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex gap-4 py-3">
              <div className="h-4 bg-gray-100 rounded w-16"></div>
              <div className="h-4 bg-gray-100 rounded flex-1"></div>
              <div className="h-4 bg-gray-100 rounded w-24"></div>
              <div className="h-4 bg-gray-100 rounded w-20"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Form loading
  if (type === 'form') {
    return (
      <div className={`bg-white rounded-2xl p-8 shadow-sm border border-gray-100 ${className}`}>
        <div className="space-y-6 animate-pulse">
          <div className="h-6 bg-gray-200 rounded-lg w-1/3 mb-8"></div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 bg-gray-200 rounded w-24"></div>
              <div className="h-10 bg-gray-100 rounded-xl w-full"></div>
            </div>
          ))}
          <div className="h-12 bg-gray-200 rounded-xl w-full mt-8"></div>
        </div>
      </div>
    );
  }

  // Generic skeleton loader
  return (
    <div className={`animate-pulse space-y-3 ${className}`}>
      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
      <div className="h-4 bg-gray-200 rounded w-1/2"></div>
      <div className="h-4 bg-gray-200 rounded w-5/6"></div>
    </div>
  );
}

/**
 * Skeleton component untuk individual items
 */
export function Skeleton({ 
  className = '',
  variant = 'text' 
}: { 
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
}) {
  const variants = {
    text: 'h-4 rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-none',
    rounded: 'rounded-lg',
  };

  return (
    <div className={`bg-gray-200 animate-pulse ${variants[variant]} ${className}`} />
  );
}

/**
 * Loading overlay untuk blocking interactions
 */
export function LoadingOverlay({ 
  message = 'Memproses...',
  show = true 
}: { 
  message?: string;
  show?: boolean;
}) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl p-8 shadow-2xl max-w-sm w-full mx-4 text-center">
        <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-sm font-bold text-gray-700 uppercase tracking-wider">
          {message}
        </p>
      </div>
    </div>
  );
}

export default LoadingFallback;
