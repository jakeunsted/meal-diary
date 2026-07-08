import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, TextInput } from 'react-native';

import { Box } from '@/components/ui/box';
import { Text } from '@/components/ui/text';
import type { ShoppingListItem } from '@/types/shoppingList';

const DEPTH_INDENT_PX = 24;

interface ShoppingListItemRowProps {
  item: ShoppingListItem;
  depth?: number;
  hideCheckbox?: boolean;
  isFocused?: boolean;
  editable?: boolean;
  inputRef?: (ref: TextInput | null) => void;
  onFocus?: () => void;
  onNameChange?: (name: string) => void;
  onBlur?: (name: string) => void;
  onSubmitEditing?: (name: string) => void;
  onCheckedChange?: (itemId: number | string, checked: boolean) => void;
  onRemove?: (itemId: number | string) => void;
  isRemoving?: boolean;
  isUpdating?: boolean;
}

export function ShoppingListItemRow({
  item,
  depth = 0,
  hideCheckbox = false,
  isFocused = false,
  editable = false,
  inputRef,
  onFocus,
  onNameChange,
  onBlur,
  onSubmitEditing,
  onCheckedChange,
  onRemove,
  isRemoving = false,
  isUpdating = false,
}: ShoppingListItemRowProps) {
  const { t } = useTranslation();
  const [draftName, setDraftName] = useState(item.name);
  const isDisabled = isRemoving || isUpdating;
  const showInput = editable && isFocused;
  const previousItemIdRef = useRef(item.id);

  useEffect(() => {
    if (previousItemIdRef.current !== item.id) {
      previousItemIdRef.current = item.id;
      setDraftName(item.name);
      return;
    }

    if (!isFocused) {
      setDraftName(item.name);
    }
  }, [isFocused, item.id, item.name]);

  const handleNameChange = (name: string) => {
    setDraftName(name);
    onNameChange?.(name);
  };

  return (
    <Box
      className="flex-row items-center gap-2 px-2 py-2"
      style={{ marginLeft: depth * DEPTH_INDENT_PX }}
      testID={`shopping-item-row-${item.id}`}
    >
      {!hideCheckbox ? (
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: item.checked }}
          className={`h-5 w-5 items-center justify-center rounded border ${
            item.checked ? 'border-primary bg-primary' : 'border-white/20'
          }`}
          disabled={isDisabled || !onCheckedChange}
          onPress={() => onCheckedChange?.(item.id, !item.checked)}
          testID={`shopping-item-checkbox-${item.id}`}
        >
          {item.checked ? <FontAwesome name="check" size={10} color="#F1F5F9" /> : null}
        </Pressable>
      ) : null}

      {showInput ? (
        <TextInput
          ref={inputRef}
          className={`flex-1 px-2 py-1 text-base text-ice ${item.checked ? 'line-through opacity-50' : ''}`}
          placeholder={t('shoppingList.enterItemName')}
          placeholderTextColor="rgba(241, 245, 249, 0.4)"
          value={draftName}
          onChangeText={handleNameChange}
          onFocus={onFocus}
          onBlur={() => onBlur?.(draftName)}
          onSubmitEditing={() => onSubmitEditing?.(draftName)}
          blurOnSubmit={false}
          returnKeyType="next"
          autoFocus
          testID={`shopping-item-edit-input-${item.id}`}
        />
      ) : (
        <Pressable
          className="flex-1"
          disabled={!editable || isDisabled}
          onPress={onFocus}
          testID={`shopping-item-name-${item.id}`}
        >
          <Text
            className={`text-base text-ice ${item.checked ? 'line-through opacity-50' : ''}`}
          >
            {item.name || (editable ? t('shoppingList.enterItemName') : '')}
          </Text>
        </Pressable>
      )}

      {onRemove ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Remove item"
          className="h-8 w-8 items-center justify-center rounded-lg"
          disabled={isDisabled}
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
