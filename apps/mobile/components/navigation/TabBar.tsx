import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { tabConfig } from '@/components/navigation/tabConfig';

export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  return (
    <View
      className="flex-row border-t border-border bg-surface"
      style={{ paddingBottom: insets.bottom }}
    >
      {state.routes.map((route: (typeof state.routes)[number], index: number) => {
        const config = tabConfig.find((item) => item.name === route.name);
        const { options } = descriptors[route.key];
        const isFocused = state.index === index;
        const label = config ? t(config.titleKey) : options.title ?? route.name;

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
            className="flex-1 items-center justify-center py-3"
          >
            <FontAwesome6
              name={config?.icon ?? 'circle'}
              size={22}
              color={isFocused ? '#6366F1' : 'rgba(241, 245, 249, 0.6)'}
            />
            <Text
              className={`mt-1 text-xs ${isFocused ? 'text-primary' : 'text-ice/60'}`}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
