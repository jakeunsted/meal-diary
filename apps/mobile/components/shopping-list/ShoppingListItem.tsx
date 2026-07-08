import { Box } from '@/components/ui/box';
import { Text } from '@/components/ui/text';
import type { ShoppingListItem } from '@/types/shoppingList';

const DEPTH_INDENT_PX = 24;

interface ShoppingListItemRowProps {
  item: ShoppingListItem;
  depth?: number;
}

export function ShoppingListItemRow({ item, depth = 0 }: ShoppingListItemRowProps) {
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
    </Box>
  );
}
