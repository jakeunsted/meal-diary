import type { ReactNode } from 'react';
import type { RefreshControlProps, StyleProp, ViewStyle } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';

interface ShoppingListScrollContainerProps {
  children: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  keyboardShouldPersistTaps?: 'always' | 'never' | 'handled';
  refreshControl?: React.ReactElement<RefreshControlProps>;
  scrollEnabled?: boolean;
}

export function ShoppingListScrollContainer({
  children,
  contentContainerStyle,
  keyboardShouldPersistTaps,
  refreshControl,
  scrollEnabled = true,
}: ShoppingListScrollContainerProps) {
  return (
    <ScrollView
      contentContainerStyle={contentContainerStyle}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      refreshControl={refreshControl}
      scrollEnabled={scrollEnabled}
    >
      {children}
    </ScrollView>
  );
}
