import FontAwesome from '@expo/vector-icons/FontAwesome';
import { ActivityIndicator, Pressable } from 'react-native';

import { Box } from '@/components/ui/box';
import { Text } from '@/components/ui/text';
import type { ShoppingListItem } from '@/types/shoppingList';

const DEPTH_INDENT_PX = 24;

interface ShoppingListItemRowProps {
  item: ShoppingListItem;
  depth?: number;
  onRemove?: (itemId: number | string) => void;
  isRemoving?: boolean;
}

export function ShoppingListItemRow({
  item,
  depth = 0,
  onRemove,
  isRemoving = false,
}: ShoppingListItemRowProps) {
  return (
    <Box
      className="flex-row items-center gap-2 px-2 py-2"
      style={{ marginLeft: depth * DEPTH_INDENT_PX }}
      testID={`shopping-item-row-${item.id}`}
    >
      <Box className="h-5 w-5 rounded border border-white/20" />
      <Text
        className={`flex-1 text-base text-ice ${item.checked ? 'line-through opacity-50' : ''}`}
        testID={`shopping-item-name-${item.id}`}
      >
        {item.name}
      </Text>
      {onRemove ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Remove item"
          className="h-8 w-8 items-center justify-center rounded-lg"
          disabled={isRemoving}
          onPress={() => onRemove(item.id)}
          testID={`shopping-item-remove-${item.id}`}
        >
          {isRemoving ? (
            <ActivityIndicator size="small" color="#F1F5F9" />
          ) : (
            <FontAwesome name="times" size={14} color="rgba(241, 245, 249, 0.7)" />
          )}
        </Pressable>
      ) : null}
    </Box>
  );
}
