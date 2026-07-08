import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { ShoppingListItemRow } from '@/components/shopping-list/ShoppingListItem';
import { Box } from '@/components/ui/box';
import { Text } from '@/components/ui/text';
import type { ShoppingListItem } from '@/types/shoppingList';

interface CheckedItemsSectionProps {
  items: ShoppingListItem[];
  getItemDepth: (item: ShoppingListItem) => number;
  hideCheckboxes?: boolean;
  isUpdating?: boolean;
  isDeleting?: boolean;
  onCheckedChange: (itemId: number | string, checked: boolean) => void;
  onRemove: (itemId: number | string) => void;
  onUncheckAll: () => void;
  onDeleteAll: () => void;
  removingItemId?: number | string | null;
}

export function CheckedItemsSection({
  items,
  hideCheckboxes = false,
  isUpdating = false,
  isDeleting = false,
  getItemDepth,
  onCheckedChange,
  onRemove,
  onUncheckAll,
  onDeleteAll,
  removingItemId = null,
}: CheckedItemsSectionProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  if (items.length === 0) {
    return null;
  }

  return (
    <Box className="mt-4 overflow-hidden rounded-2xl bg-surface">
      <Box className="flex-row items-center justify-between gap-2 px-4 py-2">
        <Pressable
          accessibilityRole="button"
          className="min-w-0 flex-1 flex-row items-center gap-2"
          onPress={() => setExpanded((current) => !current)}
          testID="shopping-list-checked-items-toggle"
        >
          <FontAwesome
            name="chevron-down"
            size={12}
            color="#F1F5F9"
            style={{ transform: [{ rotate: expanded ? '0deg' : '-90deg' }] }}
          />
          <Text className="text-sm font-medium text-ice" testID="shopping-list-checked-items-title">
            {t('shoppingList.checkedItems')} ({items.length})
          </Text>
        </Pressable>

        <Box className="shrink-0 flex-row items-center gap-1">
          <Pressable
            accessibilityRole="button"
            className="rounded-lg px-2 py-1"
            disabled={isUpdating || isDeleting}
            onPress={onUncheckAll}
            testID="shopping-list-uncheck-all"
          >
            <Text className="text-xs text-ice/80">{t('shoppingList.uncheckAll')}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            className="rounded-lg px-2 py-1"
            disabled={isUpdating || isDeleting}
            onPress={onDeleteAll}
            testID="shopping-list-delete-all-checked"
          >
            <Text className="text-xs text-red-400">{t('shoppingList.deleteAll')}</Text>
          </Pressable>
        </Box>
      </Box>

      {expanded ? (
        <Box className="px-2 pb-2">
          {items.map((item) => (
            <ShoppingListItemRow
              key={String(item.id)}
              item={item}
              depth={getItemDepth(item)}
              hideCheckbox={hideCheckboxes}
              onCheckedChange={onCheckedChange}
              onRemove={onRemove}
              isRemoving={removingItemId === item.id}
              isUpdating={isUpdating}
            />
          ))}
        </Box>
      ) : null}
    </Box>
  );
}
