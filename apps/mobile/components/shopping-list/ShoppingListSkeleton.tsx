import { Box } from '@/components/ui/box';

function SkeletonBlock({ className }: { className: string }) {
  return <Box className={`animate-pulse rounded bg-white/10 ${className}`} />;
}

function RowSkeleton() {
  return (
    <Box className="flex-row items-center gap-2 px-2 py-2">
      <SkeletonBlock className="h-5 w-5" />
      <SkeletonBlock className="h-5 w-5 rounded" />
      <SkeletonBlock className="h-5 flex-1" />
      <SkeletonBlock className="h-5 w-5" />
    </Box>
  );
}

export function ShoppingListSkeleton() {
  return (
    <Box className="mx-4 overflow-hidden rounded-2xl bg-surface px-2 py-2">
      {Array.from({ length: 6 }, (_, index) => (
        <RowSkeleton key={index} />
      ))}
    </Box>
  );
}
