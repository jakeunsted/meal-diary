import type { ReactNode } from 'react';
import type { RefreshControlProps, StyleProp, ViewStyle } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import {
  KeyboardAwareScrollView,
  type KeyboardAwareScrollViewProps,
} from 'react-native-keyboard-controller';

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
    <KeyboardAwareScrollView
      bottomOffset={24}
      contentContainerStyle={contentContainerStyle}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      refreshControl={refreshControl}
      scrollEnabled={scrollEnabled}
      ScrollViewComponent={
        ScrollView as unknown as KeyboardAwareScrollViewProps['ScrollViewComponent']
      }
      style={{ flex: 1 }}
    >
      {children}
    </KeyboardAwareScrollView>
  );
}
