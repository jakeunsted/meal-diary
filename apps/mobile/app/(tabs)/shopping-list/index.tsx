import {
  SHOPPING_CATEGORIES,
  categorizeShoppingItemName,
  isShoppingCategory,
  type ShoppingCategory,
  type ShoppingListTab,
} from '@meal-diary/shared';
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
import { ShoppingListCategoryTabs } from '@/components/shopping-list/ShoppingListCategoryTabs';
import { CheckedItemsSection } from '@/components/shopping-list/CheckedItemsSection';
import type { ShoppingListDragHandleProps } from '@/components/shopping-list/ShoppingListSortableList';
import { ShoppingListItemRow } from '@/components/shopping-list/ShoppingListItem';
import { ShoppingListScrollContainer } from '@/components/shopping-list/ShoppingListScrollContainer';
import { ShoppingListSkeleton } from '@/components/shopping-list/ShoppingListSkeleton';
import { ShoppingListViewSettingsMenu } from '@/components/shopping-list/ShoppingListViewSettingsMenu';
import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { useShoppingList } from '@/lib/shopping-list/useShoppingList';
import { useShoppingListEditor } from '@/lib/shopping-list/useShoppingListEditor';
import { useShoppingListSyncStatus } from '@/lib/shopping-list/useShoppingListSyncStatus';
import { useShoppingListViewSettings } from '@/lib/shopping-list/shoppingListViewSettings';
import { useCurrentUser } from '@/lib/queries/profile';
import type { ShoppingListItem } from '@/types/shoppingList';

function categoryLabelKey(category: ShoppingCategory): string {
  switch (category) {
    case 'meat':
      return 'shoppingList.meat';
    case 'fruit_veg':
      return 'shoppingList.fruitVeg';
    case 'bakery':
      return 'shoppingList.bakery';
    case 'canned':
      return 'shoppingList.canned';
    case 'other':
      return 'shoppingList.other';
    default:
      return 'shoppingList.other';
  }
}

export default function ShoppingListScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const userQuery = useCurrentUser();
  const familyGroupId = userQuery.data?.family_group_id;
  const userId = userQuery.data?.id ?? 0;
  const shoppingList = useShoppingList(familyGroupId);
  const editor = useShoppingListEditor();
  const syncStatus = useShoppingListSyncStatus(familyGroupId);
  const viewSettings = useShoppingListViewSettings();
  const newItemInputRef = useRef<TextInput>(null);
  const itemInputRefs = useRef(new Map<string, TextInput>());
  const [activeTab, setActiveTab] = useState<ShoppingListTab>('all');
  const [isDragging, setIsDragging] = useState(false);

  const hasListData = shoppingList.shoppingList !== null;
  const showSkeleton = shoppingList.loading && !hasListData;
  const showListLoading = shoppingList.isFetching && hasListData;
  const listItems = shoppingList.shoppingList?.items ?? [];

  const tabCounts = useMemo(() => {
    const counts: Record<ShoppingListTab, number> = {
      all: shoppingList.activeItems.length,
      meat: 0,
      fruit_veg: 0,
      bakery: 0,
      canned: 0,
      other: 0,
    };

    for (const category of SHOPPING_CATEGORIES) {
      counts[category] = shoppingList.itemsByCategory[category]?.length ?? 0;
    }

    return counts;
  }, [shoppingList.activeItems.length, shoppingList.itemsByCategory]);

  const activeItemsForTab = useMemo(() => {
    if (activeTab === 'all' || !isShoppingCategory(activeTab)) {
      return shoppingList.activeItems;
    }
    return shoppingList.itemsByCategory[activeTab] ?? [];
  }, [activeTab, shoppingList.activeItems, shoppingList.itemsByCategory]);

  const checkedItemsForTab = useMemo(() => {
    if (activeTab === 'all') {
      return shoppingList.checkedItems;
    }
    return shoppingList.checkedItems.filter((item) => item.category === activeTab);
  }, [activeTab, shoppingList.checkedItems]);

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
    const trimmedName = editor.newItemName.trim();
    if (!trimmedName) {
      return;
    }

    const category: ShoppingCategory =
      activeTab === 'all' || !isShoppingCategory(activeTab)
        ? categorizeShoppingItemName(trimmedName)
        : activeTab;

    const added = await editor.handleAddNewItem(familyGroupId, category);
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

  const handleMoveCategory = (itemId: number | string, category: ShoppingCategory) => {
    void editor.handleMoveToCategory(familyGroupId, itemId, category);
  };

  const handleReorder = (category: ShoppingCategory, orderedIds: Array<number | string>) => {
    void editor.handleReorderWithinCategory(familyGroupId, category, orderedIds);
  };

  const isItemBusy =
    editor.isUpdatingItems || editor.isPersistingItem || editor.isReordering;

  const renderEditableItem = (
    item: ShoppingListItem,
    dragHandleProps?: ShoppingListDragHandleProps
  ) => (
    <ShoppingListItemRow
      item={item}
      hideCheckbox={viewSettings.hideCheckboxes}
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
      onMoveCategory={handleMoveCategory}
      onRemove={handleRemoveItem}
      isRemoving={editor.removingItemId === item.id}
      isUpdating={isItemBusy}
      dragHandleProps={dragHandleProps}
    />
  );

  const renderCategoryList = (category: ShoppingCategory, items: ShoppingListItem[]) => {
    if (items.length === 0) {
      return null;
    }

    return (
      <ShoppingListActiveList
        items={items}
        disabled={!!editor.focusedItemId || isItemBusy}
        onDraggingChange={setIsDragging}
        onReorder={(orderedIds) => handleReorder(category, orderedIds)}
        renderItem={(item, dragHandleProps) => renderEditableItem(item, dragHandleProps)}
      />
    );
  };

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
          <Box className="relative mx-4 mb-4 items-center justify-center">
            <Heading size="2xl" className="text-ice text-center" testID="shopping-list-title">
              {t('shoppingList.title')}
            </Heading>
            <ShoppingListViewSettingsMenu
              hideCheckedItems={viewSettings.hideCheckedItems}
              hideCheckboxes={viewSettings.hideCheckboxes}
              onHideCheckedItemsChange={viewSettings.setHideCheckedItems}
              onHideCheckboxesChange={viewSettings.setHideCheckboxes}
            />
          </Box>

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

          {syncStatus.pendingCount > 0 || syncStatus.isFlushing || syncStatus.syncError ? (
            <Box
              className="mx-4 mb-4 rounded-xl bg-ice/10 px-4 py-3"
              testID="shopping-list-sync-banner"
            >
              <Text className="text-ice/80 text-sm">
                {syncStatus.syncError
                  ? t('shoppingList.syncFailed')
                  : syncStatus.isFlushing || syncStatus.isOnline
                    ? t('shoppingList.syncing')
                    : t('shoppingList.syncPending')}
              </Text>
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
                <ShoppingListCategoryTabs
                  value={activeTab}
                  onChange={setActiveTab}
                  counts={tabCounts}
                />

                {activeTab === 'all' ? (
                  SHOPPING_CATEGORIES.map((category) => {
                    const categoryItems = shoppingList.itemsByCategory[category] ?? [];
                    if (categoryItems.length === 0) {
                      return null;
                    }

                    return (
                      <Box key={category} className="mb-4">
                        <Text
                          className="mb-1 px-2 text-sm font-semibold uppercase tracking-wide text-ice/70"
                          testID={`shopping-list-section-${category}`}
                        >
                          {t(categoryLabelKey(category))}
                        </Text>
                        {renderCategoryList(category, categoryItems)}
                      </Box>
                    );
                  })
                ) : isShoppingCategory(activeTab) ? (
                  renderCategoryList(activeTab, activeItemsForTab)
                ) : null}

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

                {!viewSettings.hideCheckedItems ? (
                  <CheckedItemsSection
                    items={checkedItemsForTab}
                    hideCheckboxes={viewSettings.hideCheckboxes}
                    isUpdating={isItemBusy}
                    isDeleting={editor.isDeletingChecked}
                    onCheckedChange={handleCheckedChange}
                    onRemove={handleRemoveItem}
                    onUncheckAll={handleUncheckAll}
                    onDeleteAll={handleDeleteAllChecked}
                    removingItemId={editor.removingItemId}
                    renderItem={(item) => renderEditableItem(item)}
                  />
                ) : null}
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
