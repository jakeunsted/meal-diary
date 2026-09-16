import type { ReactNode } from 'react';

import { Heading } from '@/components/ui/heading';

interface ScreenTitleProps {
  children: ReactNode;
  testID?: string;
  className?: string;
  align?: 'center' | 'left';
}

export function ScreenTitle({
  children,
  testID,
  className = 'mb-4',
  align = 'center',
}: ScreenTitleProps) {
  const alignmentClass = align === 'left' ? '' : 'text-center';

  return (
    <Heading
      size="xl"
      className={`text-ice ${alignmentClass} ${className}`.trim()}
      testID={testID}
    >
      {children}
    </Heading>
  );
}
