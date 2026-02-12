import { ReactNode } from 'react';

type SkeletonListProps = {
  lines?: number;
};

type EmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
};

export function SkeletonList({ lines = 3 }: SkeletonListProps) {
  return (
    <div className="space-y-3">
      {Array.from({ length: lines }).map((_, idx) => (
        <div
          key={idx}
          className="h-16 rounded-2xl bg-slate-100 animate-pulse-soft"
        />
      ))}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="text-center py-16 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200 px-6">
      <div className="flex justify-center mb-4">
        {icon ?? (
          <div className="w-14 h-14 rounded-2xl bg-slate-100" />
        )}
      </div>
      <p className="text-sm font-black text-slate-500 uppercase tracking-widest mb-1">
        {title}
      </p>
      {description && (
        <p className="text-[11px] font-bold text-slate-400 max-w-xs mx-auto mb-4">
          {description}
        </p>
      )}
      {action}
    </div>
  );
}

