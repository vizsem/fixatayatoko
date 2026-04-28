'use client';

import { Activity } from 'lucide-react';

export const InventorySkeleton = () => {
  return (
    <div className="p-3 md:p-4 bg-[#FBFBFE] min-h-screen pb-32 animate-pulse">
      {/* Nav Cards Skeleton */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-16 bg-gray-100 rounded-2xl" />
        ))}
      </div>

      {/* Header Skeleton */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-3">
        <div className="space-y-2">
          <div className="h-6 w-48 bg-gray-200 rounded-lg" />
          <div className="h-2 w-24 bg-gray-100 rounded-md" />
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-10 bg-gray-200 rounded-xl" />
          <div className="h-10 w-24 bg-gray-200 rounded-xl" />
        </div>
      </div>

      {/* Filter Skeleton */}
      <div className="bg-white p-3 rounded-2xl border border-gray-50 mb-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="h-10 bg-gray-100 rounded-xl" />
          <div className="h-10 bg-gray-100 rounded-xl" />
          <div className="h-10 bg-gray-100 rounded-xl" />
        </div>
        <div className="h-6 w-32 bg-gray-50 rounded-lg" />
      </div>

      {/* Table Skeleton */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-50">
          <div className="h-4 w-full bg-gray-100 rounded" />
        </div>
        {[...Array(10)].map((_, i) => (
          <div key={i} className="p-4 border-b border-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-gray-100 rounded-xl" />
              <div className="space-y-2">
                <div className="h-3 w-32 bg-gray-100 rounded" />
                <div className="h-2 w-20 bg-gray-50 rounded" />
              </div>
            </div>
            <div className="h-6 w-16 bg-gray-50 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
};

export const TableSkeleton = ({ rows = 5 }: { rows?: number }) => (
  <div className="w-full space-y-4 animate-pulse">
    {[...Array(rows)].map((_, i) => (
      <div key={i} className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-gray-50">
        <div className="w-10 h-10 bg-gray-100 rounded-xl" />
        <div className="flex-1 space-y-2">
          <div className="h-3 bg-gray-200 rounded w-1/4" />
          <div className="h-2 bg-gray-100 rounded w-1/2" />
        </div>
        <div className="w-20 h-8 bg-gray-100 rounded-lg" />
      </div>
    ))}
  </div>
);
