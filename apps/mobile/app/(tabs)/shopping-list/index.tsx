import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { ShoppingListActiveList } from '@/components/shopping-list/ShoppingListActiveList';
import { CheckedItemsSection } from '@/components/shopping-list/CheckedItemsSection';
import type { ShoppingListDragRenderProps } from '@/components/shopping-list/shoppingListDndTypes';
import { ShoppingListItemRow } from '@/components/shopping-list/ShoppingListItem';
import { ShoppingListScrollContainer } from '@/components/shopping-list/ShoppingListScrollContainer';
import { ShoppingListSkeleton } from '@/components/shopping-list/ShoppingListSkeleton';
import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import {
  buildShoppingListDepthMap,
  getShoppingListItemDepth,
} from '@/lib/shopping-list/shoppingListDrop';
import { useShoppingList } from '@/lib/shopping-list/useShoppingList';
import { useShoppingListEditor } from '@/lib/shopping-list/useShoppingListEditor';
import { useCurrentUser } from '@/lib/queries/profile';
import type { ShoppingListItem } from '@/types/shoppingList';

export default function ShoppingListScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const userQuery = useCurrentUser();
  const familyGroupId = userQuery.data?.family_group_id;
  const userId = userQuery.data?.id ?? 0;
  const shoppingList = useShoppingList(familyGroupId);
  const editor = useShoppingListEditor();
  const newItemInputRef = useRef<TextInput>(null);
  const itemInputRefs = useRef(new Map<string, TextInput>());
  const [isDragging, setIsDragging] = useState(false);

  const hasListData = shoppingList.shoppingList !== null;
  const showSkeleton = shoppingList.loading && !hasListData;
  const showListLoading = shoppingList.isFetching && hasListData;
  const listItems = shoppingList.shoppingList?.items ?? [];

  const itemDepthMap = useMemo(() => {
    if (!shoppingList.shoppingList?.items) {
      return {};
    }
    return buildShoppingListDepthMap(shoppingList.shoppingList.items);
  }, [shoppingList.shoppingList?.items]);

  const getItemDepth = (item: ShoppingListItem) =>
    getShoppingListItemDepth(item, itemDepthMap);

  const setItemInputRef = useCallback((itemId: number | string, ref: TextInput | null) => {
    const key = String(itemId);
    if (ref) {
      itemInputRefs.current.set(key, ref);
      return;
    }
    itemInputRefs.current.delete(key);
  }, []);

  useEffect(() => {
    if (!editor.focusedItemId) {
      return;
    }

    const input = itemInputRefs.current.get(String(editor.focusedItemId));
    input?.focus();
  }, [editor.focusedItemId]);

  const handleRefresh = () => {
    void userQuery.refetch();
    void shoppingList.refresh();
  };

  const handleRetry = () => {
    void shoppingList.refresh();
  };

  const handleAddNewItem = async () => {
    const added = await editor.handleAddNewItem(familyGroupId);
    if (added) {
      newItemInputRef.current?.focus();
    }
  };

  const handleRemoveItem = (itemId: number | string) => {
    void editor.handleRemoveItem(familyGroupId, itemId);
  };

  const handleCheckedChange = (itemId: number | string, checked: boolean) => {
    void editor.handleSetItemChecked(familyGroupId, listItems, itemId, checked);
  };

  const handleUncheckAll = () => {
    void editor.handleUncheckAll(familyGroupId, listItems);
  };

  const handleDeleteAllChecked = () => {
    void editor.handleDeleteAllChecked(familyGroupId, listItems);
  };

  const isItemBusy =
    editor.isUpdatingItems || editor.isPersistingItem || editor.isReordering;

  const renderEditableItem = (
    item: ShoppingListItem,
    dragProps?: ShoppingListDragRenderProps
  ) => (
    <ShoppingListItemRow
      item={item}
      depth={dragProps?.depth ?? getItemDepth(item)}
      editable
      isFocused={editor.focusedItemId === item.id}
      inputRef={(ref) => setItemInputRef(item.id, ref)}
      onFocus={() => editor.focusItem(item.id)}
      onNameChange={(name) => editor.handleItemNameChange(familyGroupId, item.id, name)}
      onBlur={(name) => {
        void editor.handleItemBlur(familyGroupId, item.id, name);
      }}
      onSubmitEditing={(name) => {
        void editor.handleItemSubmitEditing(familyGroupId, item.id, name, userId);
      }}
      onCheckedChange={handleCheckedChange}
      onIndent={(itemId) => {
        void editor.handleIndentItem(familyGroupId, listItems, itemId);
      }}
      onOutdent={(itemId) => {
        void editor.handleOutdentItem(familyGroupId, listItems, itemId);
      }}
      onRemove={handleRemoveItem}
      isRemoving={editor.removingItemId === item.id}
      isUpdating={isItemBusy}
      drag={dragProps?.drag}
      isActive={dragProps?.isActive}
      onDragPointerMove={dragProps?.onDragPointerMove}
    />
  );

  return (
    <Box className="flex-1 bg-base">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ShoppingListScrollContainer
          contentContainerClassName="pb-8"
          contentContainerStyle={{ paddingTop: insets.top + 24 }}
          keyboardShouldPersistTaps="handled"
          scrollEnabled={!isDragging}
          refreshControl={
            isDragging ? undefined : (
              <RefreshControl
                refreshing={shoppingList.isFetching && !shoppingList.loading}
                onRefresh={handleRefresh}
                tintColor="#6366F1"
              />
            )
          }
        >
          <Heading size="2xl" className="text-ice mb-4 text-center" testID="shopping-list-title">
            {t('shoppingList.title')}
          </Heading>

          {shoppingList.lastFetchError && !shoppingList.loading ? (
            <Box
              className="mx-4 mb-4 flex-row items-center justify-between rounded-xl bg-red-500/15 px-4 py-3"
              testID="shopping-list-load-error"
            >
              <Text className="text-red-400 flex-1 text-sm">{t('shoppingList.loadFailed')}</Text>
              <Button
                size="sm"
                variant="outline"
                onPress={handleRetry}
                testID="shopping-list-retry-button"
              >
                <ButtonText>{t('shoppingList.retry')}</ButtonText>
              </Button>
            </Box>
          ) : null}

          {editor.actionError ? (
            <Box
              className="mx-4 mb-4 rounded-xl bg-red-500/15 px-4 py-3"
              testID="shopping-list-action-error"
            >
              <Text className="text-red-400 text-sm">{t('shoppingList.actionFailed')}</Text>
            </Box>
          ) : null}

          {showSkeleton ? (
            <ShoppingListSkeleton />
          ) : (
            <Box className="relative mx-4">
              <Box className={showListLoading ? 'opacity-50' : ''}>
                <ShoppingListActiveList
                  activeItems={shoppingList.activeItems}
                  allItems={listItems}
                  disabled={!!editor.focusedItemId || isItemBusy}
                  onDraggingChange={setIsDragging}
                  onDragEnd={(params) => {
                    void editor.handleDragReorder(familyGroupId, listItems, params);
                  }}
                  renderItem={(item, dragProps) => renderEditableItem(item, dragProps)}
                />

                <Box className="mt-4 flex-row items-center gap-2">
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('shoppingList.addItem')}
                    className="h-8 w-8 items-center justify-center rounded-lg border border-primary"
                    disabled={editor.isAdding}
                    onPress={handleAddNewItem}
                    testID="shopping-list-new-item-button"
                  >
                    {editor.isAdding ? (
                      <ActivityIndicator size="small" color="#6366F1" />
                    ) : (
                      <FontAwesome name="plus" size={12} color="#6366F1" />
                    )}
                  </Pressable>
                  <TextInput
                    ref={newItemInputRef}
                    className="flex-1 px-2 py-2 text-base text-ice"
                    placeholder={t('shoppingList.enterNewItem')}
                    placeholderTextColor="rgba(241, 245, 249, 0.4)"
                    value={editor.newItemName}
                    onChangeText={(value) => {
                      editor.clearActionError();
                      editor.setNewItemName(value);
                    }}
                    onSubmitEditing={handleAddNewItem}
                    returnKeyType="done"
                    testID="shopping-list-new-item-input"
                  />
                </Box>

                <CheckedItemsSection
                  items={shoppingList.checkedItems}
                  getItemDepth={getItemDepth}
                  isUpdating={isItemBusy}
                  isDeleting={editor.isDeletingChecked}
                  onCheckedChange={handleCheckedChange}
                  onRemove={handleRemoveItem}
                  onUncheckAll={handleUncheckAll}
                  onDeleteAll={handleDeleteAllChecked}
                  removingItemId={editor.removingItemId}
                  renderItem={(item) => renderEditableItem(item)}
                />
              </Box>

              {showListLoading ? (
                <Box
                  className="absolute inset-0 items-center justify-center"
                  testID="shopping-list-loading"
                >
                  <ActivityIndicator size="large" color="#6366F1" />
                </Box>
              ) : null}
            </Box>
          )}
        </ShoppingListScrollContainer>
      </KeyboardAvoidingView>
    </Box>
  );
}
