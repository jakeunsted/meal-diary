import { Box } from '@/components/ui/box';

function SkeletonBlock({ className }: { className: string }) {
  return <Box className={`animate-pulse rounded bg-white/10 ${className}`} />;
}

function DayCardSkeleton() {
  return (
    <Box className="mx-4 mb-4 overflow-hidden rounded-2xl bg-surface">
      <Box className="flex-row items-center justify-between px-6 py-4">
        <SkeletonBlock className="h-6 w-32" />
        <SkeletonBlock className="h-6 w-6" />
      </Box>
      <Box className="gap-4 bg-base px-6 pb-5 pt-2">
        <Box className="flex-row items-center justify-between">
          <SkeletonBlock className="h-6 w-24" />
          <SkeletonBlock className="h-8 w-32" />
        </Box>
        <Box className="flex-row items-center justify-between">
          <SkeletonBlock className="h-6 w-24" />
          <SkeletonBlock className="h-8 w-32" />
        </Box>
        <Box className="flex-row items-center justify-between">
          <SkeletonBlock className="h-6 w-24" />
          <SkeletonBlock className="h-8 w-32" />
        </Box>
      </Box>
    </Box>
  );
}

export function DiarySkeleton() {
  return (
    <Box>
      <Box className="items-center px-4 py-4">
        <SkeletonBlock className="mb-2 h-6 w-32" />
        <Box className="flex-row items-center justify-center gap-2">
          <SkeletonBlock className="h-10 w-10" />
          <SkeletonBlock className="h-10 w-48" />
          <SkeletonBlock className="h-10 w-10" />
        </Box>
      </Box>

      {Array.from({ length: 7 }, (_, index) => (
        <DayCardSkeleton key={index} />
      ))}
    </Box>
  );
}
