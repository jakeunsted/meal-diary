import type { ReactNode } from 'react';

import { Box } from '@/components/ui/box';
import { Heading } from '@/components/ui/heading';

interface ProfileCardProps {
  title: string;
  children: ReactNode;
  className?: string;
}

export function ProfileCard({ title, children, className }: ProfileCardProps) {
  return (
    <Box className={`overflow-hidden rounded-2xl bg-surface ${className ?? ''}`}>
      <Box className="border-b border-white/10 px-5 py-4">
        <Heading size="lg" className="text-ice">
          {title}
        </Heading>
      </Box>
      <Box className="px-5 py-5">{children}</Box>
    </Box>
  );
}
