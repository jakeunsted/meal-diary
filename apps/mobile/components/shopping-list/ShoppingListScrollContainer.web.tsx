import type { ReactNode } from 'react';
import type { RefreshControlProps } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';

interface ShoppingListScrollContainerProps {
  children: ReactNode;
  contentContainerClassName?: string;
  contentContainerStyle?: object;
  keyboardShouldPersistTaps?: 'always' | 'never' | 'handled';
  refreshControl?: React.ReactElement<RefreshControlProps>;
  scrollEnabled?: boolean;
}

export function ShoppingListScrollContainer({
  children,
  contentContainerClassName,
  contentContainerStyle,
  keyboardShouldPersistTaps,
  refreshControl,
  scrollEnabled = true,
}: ShoppingListScrollContainerProps) {
  return (
    <ScrollView
      contentContainerClassName={contentContainerClassName}
      contentContainerStyle={contentContainerStyle}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      refreshControl={refreshControl}
      scrollEnabled={scrollEnabled}
    >
      {children}
    </ScrollView>
  );
}
