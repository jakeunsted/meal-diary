import FontAwesome from '@expo/vector-icons/FontAwesome';
import type { ComponentProps } from 'react';
import { Platform, type StyleProp, type TextStyle } from 'react-native';

import { colors } from '@/constants/theme';

export type TabBarIconName = ComponentProps<typeof FontAwesome>['name'];

interface TabBarIconProps {
  name: TabBarIconName;
  focused: boolean;
  testID?: string;
}

const webIconStyle: StyleProp<TextStyle> = {
  fontFamily: 'FontAwesome',
  fontStyle: 'normal',
  fontWeight: 'normal',
};

export function TabBarIcon({ name, focused, testID }: TabBarIconProps) {
  const color = focused ? colors.primary : 'rgba(241, 245, 249, 0.55)';

  return (
    <FontAwesome
      name={name}
      size={20}
      color={color}
      testID={testID}
      style={Platform.OS === 'web' ? webIconStyle : undefined}
    />
  );
}
