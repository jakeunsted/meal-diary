import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, Switch, View } from 'react-native';

import { Box } from '@/components/ui/box';
import { Text } from '@/components/ui/text';

interface ShoppingListViewSettingsMenuProps {
  hideCheckedItems: boolean;
  hideCheckboxes: boolean;
  onHideCheckedItemsChange: (value: boolean) => void;
  onHideCheckboxesChange: (value: boolean) => void;
}

export function ShoppingListViewSettingsMenu({
  hideCheckedItems,
  hideCheckboxes,
  onHideCheckedItemsChange,
  onHideCheckboxesChange,
}: ShoppingListViewSettingsMenuProps) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('shoppingList.viewSettings')}
        className="absolute right-0 top-1 h-9 w-9 items-center justify-center rounded-full"
        onPress={() => setVisible(true)}
        testID="shopping-list-settings-button"
      >
        <FontAwesome name="ellipsis-v" size={16} color="rgba(241, 245, 249, 0.85)" />
      </Pressable>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <Pressable
          className="flex-1 justify-start bg-black/50 px-4 pt-24"
          onPress={() => setVisible(false)}
        >
          <Pressable onPress={(event) => event.stopPropagation()}>
            <Box className="ml-auto w-64 overflow-hidden rounded-2xl bg-surface p-3 shadow-lg">
              <Text className="text-ice mb-3 px-1 text-sm font-semibold">
                {t('shoppingList.viewSettings')}
              </Text>

              <View className="mb-2 flex-row items-center justify-between rounded-xl px-2 py-2">
                <Text className="text-ice mr-3 flex-1 text-sm">
                  {t('shoppingList.hideCheckedItems')}
                </Text>
                <Switch
                  value={hideCheckedItems}
                  onValueChange={onHideCheckedItemsChange}
                  trackColor={{ false: 'rgba(241, 245, 249, 0.2)', true: '#6366F1' }}
                  thumbColor="#F1F5F9"
                  testID="shopping-list-hide-checked-toggle"
                />
              </View>

              <View className="flex-row items-center justify-between rounded-xl px-2 py-2">
                <Text className="text-ice mr-3 flex-1 text-sm">
                  {t('shoppingList.hideCheckboxes')}
                </Text>
                <Switch
                  value={hideCheckboxes}
                  onValueChange={onHideCheckboxesChange}
                  trackColor={{ false: 'rgba(241, 245, 249, 0.2)', true: '#6366F1' }}
                  thumbColor="#F1F5F9"
                  testID="shopping-list-hide-checkboxes-toggle"
                />
              </View>
            </Box>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
