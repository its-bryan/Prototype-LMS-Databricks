/**
 * Animated skeleton placeholders shown while DataContext fetches data.
 */
import { useState, useEffect } from "react";

export function usePageTransition() {
  const [ready, setReady] = useState(false);
  useEffect(() => { setReady(true); }, []);
  return ready;
}

export const Bone = ({ className = "" }) => (
  <div className={`animate-pulse rounded bg-[var(--neutral-200)] ${className}`} />
);

export const DarkBone = ({ className = "" }) => (
  <div className={`animate-pulse rounded bg-white/10 ${className}`} />
);

export function MetricTileSkeleton({ index = 0 }) {
  return (
    <div
      className="bg-neutral-700 border border-white/20 rounded-lg px-4 py-3"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <DarkBone className="h-3 w-24 mb-3" />
      <div className="flex items-center gap-2">
        <DarkBone className="h-6 w-14" />
        <DarkBone className="h-4 w-10 rounded-sm" />
      </div>
    </div>
  );
}

export function SectionHeaderSkeleton() {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-3">
        <div className="w-1 h-6 bg-[var(--neutral-200)] rounded-full" />
        <Bone className="h-5 w-28" />
      </div>
      <Bone className="h-3 w-48 ml-4 mt-1.5" />
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="border border-[var(--neutral-200)] rounded-lg bg-white overflow-hidden">
      <div className="px-5 pt-5 pb-4">
        <div className="flex gap-3 mb-4">
          <Bone className="h-8 w-36" />
          <Bone className="h-8 w-36" />
          <Bone className="h-8 w-28" />
          <Bone className="h-8 w-20" />
        </div>
        <Bone className="h-3 w-64 mb-4" />
        <div className="flex items-end gap-3 h-52 px-4 pb-2">
          {[0.6, 0.8, 0.45, 0.9, 0.55, 0.7, 0.35, 0.65].map((h, i) => (
            <div key={i} className="flex-1 flex flex-col justify-end h-full">
              <Bone className="w-full rounded-none" style={{ height: `${h * 100}%` }} />
            </div>
          ))}
        </div>
        <div className="flex gap-3 mt-3 px-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Bone key={i} className="flex-1 h-3" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5 }) {
  return (
    <div className="border border-[var(--neutral-200)] rounded-lg bg-white overflow-hidden">
      <div className="px-5 py-4">
        <div className="flex items-center gap-3 mb-4">
          <Bone className="h-4 w-24" />
          <Bone className="h-7 w-48 ml-auto" />
          <Bone className="h-7 w-20" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex gap-4 items-center">
              <Bone className="h-4 w-28" />
              <Bone className="h-4 w-20" />
              <Bone className="h-4 w-16" />
              <Bone className="h-4 w-24 ml-auto" />
              <Bone className="h-5 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function WorkModuleSkeleton() {
  return (
    <div className="border border-[var(--neutral-200)] rounded-lg bg-white overflow-hidden">
      <div className="px-5 py-4">
        <Bone className="h-5 w-32 mb-3" />
        <Bone className="h-3 w-56 mb-4" />
        <div className="space-y-3">
          <Bone className="h-12 w-full" />
          <Bone className="h-12 w-full" />
          <Bone className="h-12 w-full" />
        </div>
        <Bone className="h-8 w-full mt-4 rounded-md" />
      </div>
    </div>
  );
}

export function BMDashboardSkeleton() {
  return (
    <div className="max-w-[var(--container-max)]">
      {/* Work section */}
      <div className="mb-4">
        <SectionHeaderSkeleton />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <WorkModuleSkeleton />
          <WorkModuleSkeleton />
        </div>
      </div>

      {/* Summary section */}
      <div className="mb-4">
        <SectionHeaderSkeleton />
        {/* Date preset */}
        <div className="flex items-center gap-2 mb-4">
          <Bone className="h-7 w-28 rounded-md" />
        </div>
        {/* Primary tiles 3-col */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[0, 1, 2].map((i) => (
            <MetricTileSkeleton key={i} index={i} />
          ))}
        </div>
        {/* Secondary tiles 3-col */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[3, 4, 5].map((i) => (
            <MetricTileSkeleton key={i} index={i} />
          ))}
        </div>
        {/* Chart */}
        <ChartSkeleton />
      </div>

      {/* Leads table */}
      <div className="mb-4">
        <SectionHeaderSkeleton />
        <TableSkeleton rows={5} />
      </div>

      {/* Tasks table */}
      <div className="mb-4">
        <SectionHeaderSkeleton />
        <TableSkeleton rows={3} />
      </div>
    </div>
  );
}

export function GMDashboardSkeleton() {
  return (
    <div className="max-w-[var(--container-max)]">
      {/* Greeting */}
      <div className="mb-4">
        <Bone className="h-3 w-24 mb-2" />
        <Bone className="h-9 w-48 mb-2" />
        <Bone className="h-4 w-72" />
      </div>

      {/* Date preset */}
      <div className="flex items-center gap-2 mb-4">
        <Bone className="h-7 w-28 rounded-md" />
      </div>

      {/* 6 metric tiles in 3x2 grid */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <MetricTileSkeleton key={i} index={i} />
        ))}
      </div>

      {/* Compliance / branch breakdown */}
      <div className="mb-4">
        <SectionHeaderSkeleton />
        <div className="border border-[var(--neutral-200)] rounded-lg bg-white overflow-hidden">
          <div className="px-5 py-4">
            <div className="flex gap-3 mb-4">
              <Bone className="h-8 w-32" />
              <Bone className="h-8 w-24" />
              <Bone className="h-8 w-28 ml-auto" />
            </div>
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex gap-4 items-center">
                  <Bone className="h-4 w-32" />
                  <Bone className="h-4 w-16" />
                  <Bone className="h-4 w-16" />
                  <Bone className="h-4 w-16" />
                  <Bone className="h-4 w-16" />
                  <Bone className="h-5 w-16 rounded-full ml-auto" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BackButtonBone() {
  return <Bone className="h-8 w-24 rounded-md mb-4" />;
}

function FilterRowSkeleton({ count = 4 }) {
  return (
    <div className="flex items-center gap-2 mb-4 flex-wrap">
      {Array.from({ length: count }).map((_, i) => (
        <Bone key={i} className="h-9 w-36 rounded-lg" />
      ))}
      <Bone className="h-9 w-48 rounded-lg ml-auto" />
    </div>
  );
}

function CardSkeleton({ className = "" }) {
  return (
    <div className={`border border-[var(--neutral-200)] rounded-lg bg-white px-4 py-3 ${className}`}>
      <Bone className="h-3 w-28 mb-3" />
      <Bone className="h-7 w-16 mb-1" />
      <Bone className="h-3 w-20" />
    </div>
  );
}

export function MeetingPrepSkeleton() {
  return (
    <div>
      <SectionHeaderSkeleton />
      <div className="flex items-center gap-2 mb-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Bone key={i} className="h-7 w-24 rounded-md" />
        ))}
      </div>
      <Bone className="h-3 w-64 mb-4" />
      <div className="grid grid-cols-2 gap-3 mb-6">
        {[0, 1, 2, 3].map((i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 mb-6">
        {[0, 1, 2, 3].map((i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
      <Bone className="h-3 w-40 mb-2" />
      <Bone className="h-8 w-full rounded-full mb-6" />
      <TableSkeleton rows={5} />
    </div>
  );
}

export function SpotCheckSkeleton() {
  return (
    <div className="max-w-6xl">
      <BackButtonBone />
      <Bone className="h-8 w-64 mb-2" />
      <Bone className="h-4 w-96 mb-6" />
      <div className="flex items-center gap-2 mb-4">
        <Bone className="h-9 w-48 rounded-lg" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Bone key={i} className="h-7 w-24 rounded-md" />
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        {[0, 1, 2, 3, 4].map((i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
      <TableSkeleton rows={6} />
    </div>
  );
}

export function GMMeetingPrepSkeleton() {
  return (
    <div className="max-w-6xl">
      <BackButtonBone />
      <Bone className="h-8 w-72 mb-2" />
      <Bone className="h-4 w-96 mb-6" />
      <div className="flex items-center gap-2 mb-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Bone key={i} className="h-7 w-24 rounded-md" />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[0, 1, 2].map((i) => (
          <MetricTileSkeleton key={i} index={i} />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2 mb-6">
        {[3, 4, 5].map((i) => (
          <MetricTileSkeleton key={i} index={i} />
        ))}
      </div>
      <div className="border border-[var(--neutral-200)] rounded-lg bg-white p-5 mb-6">
        <Bone className="h-5 w-40 mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Bone key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
      <TableSkeleton rows={4} />
    </div>
  );
}

export function GMLeaderboardSkeleton() {
  return (
    <div className="space-y-6">
      <BackButtonBone />
      <Bone className="h-8 w-56 mb-2" />
      <Bone className="h-4 w-80 mb-4" />
      <div className="flex items-center gap-2 mb-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Bone key={i} className="h-8 w-28 rounded-md" />
        ))}
      </div>
      <div className="flex items-center gap-2 mb-4">
        <Bone className="h-8 w-32 rounded-md" />
        <Bone className="h-8 w-32 rounded-md" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 border border-[var(--neutral-200)] rounded-lg bg-white px-4 py-3">
            <Bone className="h-6 w-6 rounded-full" />
            <Bone className="h-4 w-32" />
            <Bone className="h-5 w-full max-w-xs rounded-full" />
            <Bone className="h-4 w-12 ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function GMLeadsPageSkeleton() {
  return (
    <div className="flex flex-col h-full gap-0">
      <BackButtonBone />
      <Bone className="h-8 w-48 mb-2" />
      <Bone className="h-4 w-72 mb-4" />
      <FilterRowSkeleton count={5} />
      <TableSkeleton rows={8} />
    </div>
  );
}

export function BMLeaderboardSkeleton() {
  return (
    <div>
      <SectionHeaderSkeleton />
      <div className="flex items-center gap-2 mb-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Bone key={i} className="h-7 w-24 rounded-md" />
        ))}
      </div>
      <div className="border border-[var(--neutral-200)] rounded-lg bg-white overflow-hidden p-5">
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Bone className="h-4 w-8" />
              <Bone className="h-4 w-28" />
              <Bone className="h-6 w-full max-w-sm rounded-full" />
              <Bone className="h-4 w-12 ml-auto" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ComplianceSkeleton() {
  return (
    <div>
      <SectionHeaderSkeleton />
      <div className="flex items-center gap-2 mb-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Bone key={i} className="h-7 w-28 rounded-md" />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[0, 1, 2].map((i) => (
          <MetricTileSkeleton key={i} index={i} />
        ))}
      </div>
      <TableSkeleton rows={6} />
    </div>
  );
}

export function ActivityReportSkeleton() {
  return (
    <div className="space-y-6">
      <BackButtonBone />
      <Bone className="h-8 w-48 mb-2" />
      <Bone className="h-4 w-72 mb-4" />
      <FilterRowSkeleton count={3} />
      <TableSkeleton rows={8} />
    </div>
  );
}

export function LeadDetailSkeleton() {
  return (
    <div>
      <BackButtonBone />
      <div className="flex gap-6">
        <div className="flex-1 space-y-4">
          <div className="border border-[var(--neutral-200)] rounded-lg bg-white p-5">
            <div className="flex items-center gap-3 mb-4">
              <Bone className="h-7 w-48" />
              <Bone className="h-6 w-20 rounded-full ml-auto" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i}>
                  <Bone className="h-3 w-20 mb-1" />
                  <Bone className="h-4 w-32" />
                </div>
              ))}
            </div>
          </div>
          <div className="border border-[var(--neutral-200)] rounded-lg bg-white p-5">
            <Bone className="h-5 w-32 mb-3" />
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Bone key={i} className="h-10 w-full" />
              ))}
            </div>
          </div>
        </div>
        <div className="w-96 shrink-0">
          <div className="border border-[var(--neutral-200)] rounded-lg bg-white p-5">
            <Bone className="h-5 w-36 mb-4" />
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i}>
                  <Bone className="h-3 w-24 mb-1" />
                  <Bone className="h-9 w-full rounded-md" />
                </div>
              ))}
            </div>
            <Bone className="h-10 w-full rounded-md mt-4" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function TaskDetailSkeleton() {
  return (
    <div className="max-w-2xl">
      <BackButtonBone />
      <div className="border border-[var(--neutral-200)] rounded-lg bg-white p-6">
        <div className="flex items-center gap-3 mb-6">
          <Bone className="h-7 w-56" />
          <Bone className="h-6 w-20 rounded-full ml-auto" />
        </div>
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i}>
              <Bone className="h-3 w-24 mb-1" />
              <Bone className="h-5 w-48" />
            </div>
          ))}
        </div>
        <div className="mt-6 pt-4 border-t border-[var(--neutral-200)]">
          <Bone className="h-5 w-24 mb-3" />
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Bone key={i} className="h-12 w-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
