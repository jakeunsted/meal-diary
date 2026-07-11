import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { TabBarIcon } from '@/components/navigation/TabBarIcon';
import { getTabConfig, tabConfig } from '@/components/navigation/tabConfig';
import { colors } from '@/constants/theme';

export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  return (
    <View
      className="border-t border-border bg-surface px-2 pt-2"
      style={{ paddingBottom: Math.max(insets.bottom, 8) }}
    >
      <View className="flex-row">
        {state.routes.map((route: (typeof state.routes)[number], index: number) => {
          const config = getTabConfig(route.name) ?? tabConfig[index];
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;
          const label = config ? t(config.titleKey) : options.title ?? route.name;
          const iconColor = isFocused ? colors.primary : 'rgba(241, 245, 249, 0.55)';

          const icon =
            options.tabBarIcon?.({
              focused: isFocused,
              color: iconColor,
              size: 20,
            }) ??
            (config ? (
              <TabBarIcon
                name={config.icon}
                focused={isFocused}
                testID={`${config.testID}-icon`}
              />
            ) : null);

          const handlePress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={label}
              testID={config?.testID}
              onPress={handlePress}
              className="flex-1 items-center justify-center rounded-xl px-1 py-2"
              style={isFocused ? { backgroundColor: 'rgba(99, 102, 241, 0.12)' } : undefined}
            >
              {icon}
              <Text
                className={`mt-1 text-center text-[11px] leading-tight ${
                  isFocused ? 'font-semibold text-primary' : 'text-ice/55'
                }`}
                numberOfLines={1}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
