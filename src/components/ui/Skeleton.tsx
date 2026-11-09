import React from 'react';

export const Bone: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse rounded-md bg-slate-200/70 ${className}`} aria-hidden="true" />
);

/** Page-shaped placeholder while a page's code or data loads. */
export const PageSkeleton: React.FC = () => (
  <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 md:px-8 md:py-8" role="status" aria-label="Loading">
    <div className="space-y-2">
      <Bone className="h-6 w-48" />
      <Bone className="h-4 w-72" />
    </div>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="card space-y-3 p-4">
          <Bone className="h-3 w-20" />
          <Bone className="h-6 w-28" />
        </div>
      ))}
    </div>
    <div className="card divide-y divide-slate-100">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-4">
          <Bone className="h-8 w-8 rounded-full" />
          <div className="flex-1 space-y-2">
            <Bone className="h-3.5 w-1/3" />
            <Bone className="h-3 w-1/4" />
          </div>
          <Bone className="h-4 w-20" />
        </div>
      ))}
    </div>
  </div>
);

/** Whole-app placeholder (sidebar + header + page) while the workspace opens. */
export const AppSkeleton: React.FC = () => (
  <div className="flex h-screen overflow-hidden bg-slate-50" role="status" aria-label="Opening workspace">
    <aside className="hidden w-[248px] flex-shrink-0 space-y-3 border-r border-slate-200/80 p-3 lg:block">
      <div className="flex items-center gap-2.5 p-1.5">
        <Bone className="h-8 w-8 rounded-lg" />
        <Bone className="h-4 w-24" />
      </div>
      <Bone className="h-9 w-full rounded-lg" />
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <Bone key={i} className="h-7 w-full" />
      ))}
    </aside>
    <div className="flex flex-1 flex-col">
      <div className="flex h-14 items-center gap-3 border-b border-slate-200/80 bg-white px-6">
        <Bone className="h-4 w-28" />
        <div className="flex-1" />
        <Bone className="hidden h-9 w-72 rounded-lg md:block" />
      </div>
      <PageSkeleton />
    </div>
  </div>
);
