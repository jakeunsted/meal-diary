import { useEffect, useRef, type ReactNode } from 'react';
import { View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';

import {
  notifyTourTargetsChanged,
  registerTourTarget,
  unregisterTourTarget,
  type TourTargetRect,
} from '@/lib/onboarding/tourTargets';

interface TourTargetProps {
  id: string;
  children: ReactNode;
  className?: string;
  style?: StyleProp<ViewStyle>;
}

export function TourTarget({ id, children, className, style }: TourTargetProps) {
  const viewRef = useRef<View>(null);

  useEffect(() => {
    const measure = (): Promise<TourTargetRect | null> =>
      new Promise((resolve) => {
        const node = viewRef.current;
        if (!node) {
          resolve(null);
          return;
        }
        node.measureInWindow((x, y, width, height) => {
          if (width <= 0 || height <= 0) {
            resolve(null);
            return;
          }
          resolve({ x, y, width, height });
        });
      });

    registerTourTarget(id, measure);
    return () => {
      unregisterTourTarget(id);
    };
  }, [id]);

  const handleLayout = (_event: LayoutChangeEvent) => {
    notifyTourTargetsChanged();
  };

  return (
    <View
      ref={viewRef}
      collapsable={false}
      className={className}
      style={style}
      onLayout={handleLayout}
    >
      {children}
    </View>
  );
}
