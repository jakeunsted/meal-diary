import type { InjectionKey } from 'vue';
import { Preferences } from '@capacitor/preferences';
import {
  SHOPPING_CATEGORIES,
  categorizeShoppingItemName,
  groupShoppingListItemsByCategory,
  isShoppingCategory,
  type ShoppingCategory,
  type ShoppingListTab,
} from '@meal-diary/shared';
import { useShoppingListStore } from '~/stores/shoppingList';
import { useUserStore } from '~/stores/user';
import { flattenShoppingListItems } from '~/utils/shoppingListTree';
import type { ShoppingListItem as ShoppingListItemType } from '~/types/ShoppingList';

export const useShoppingListScreen = () => {
  const { pullToRefreshEnabled } = usePullToRefreshEnabled();
  const shoppingListStore = useShoppingListStore();
  const userStore = useUserStore();
  const { track } = useAnalytics();
  const { showActionToast } = useToast();
  const { t } = useI18n();

  const loading = ref(true);
  const hasData = computed(() => {
    return !loading.value && !!shoppingListStore.shoppingList;
  });

  const newItemName = ref('');
  const newItemInput = ref<HTMLInputElement | null>(null);
  const checkedItemsExpanded = ref(false);
  const activeTab = ref<ShoppingListTab>('all');
  const categories = SHOPPING_CATEGORIES;

  const VIEW_SETTINGS_KEY = 'shoppingListViewSettings';
  const hideCheckedItems = ref(false);
  const hideCheckboxes = ref(false);
  let viewSettingsLoaded = false;

  const loadViewSettings = async () => {
    if (!import.meta.client) {
      return;
    }
    try {
      const { value } = await Preferences.get({ key: VIEW_SETTINGS_KEY });
      if (value) {
        const parsed = JSON.parse(value);
        hideCheckedItems.value = !!parsed.hideCheckedItems;
        hideCheckboxes.value = !!parsed.hideCheckboxes;
      }
    } catch (error) {
      console.warn('Failed to load shopping list view settings:', error);
    } finally {
      viewSettingsLoaded = true;
    }
  };

  const persistViewSettings = async () => {
    if (!import.meta.client || !viewSettingsLoaded) {
      return;
    }
    await Preferences.set({
      key: VIEW_SETTINGS_KEY,
      value: JSON.stringify({
        hideCheckedItems: hideCheckedItems.value,
        hideCheckboxes: hideCheckboxes.value
      })
    });
  };

  watch([hideCheckedItems, hideCheckboxes], () => {
    void persistViewSettings();
  });

  const handleError = (error: unknown) => {
    console.error('Error in shopping list page:', error);
  };

  const handlePullRefresh = async () => {
    await shoppingListStore.fetchShoppingList(true);
  };

  const orderedItems = computed(() => {
    if (!shoppingListStore.shoppingList?.items) {
      return [];
    }
    return flattenShoppingListItems(shoppingListStore.shoppingList.items);
  });

  const activeItems = computed(() => {
    return orderedItems.value.filter(item => !item.checked);
  });

  const checkedItems = computed(() => {
    return orderedItems.value.filter(item => {
      if (!item.checked) {
        return false;
      }
      if (activeTab.value === 'all') {
        return true;
      }
      return item.category === activeTab.value;
    });
  });

  const hasCheckedItems = computed(() => checkedItems.value.length > 0);

  const activeItemsByCategory = computed(() => {
    return groupShoppingListItemsByCategory(
      activeItems.value.map((item) => ({
        ...item,
        category: (isShoppingCategory(item.category) ? item.category : 'other') as ShoppingCategory,
      }))
    ) as Record<ShoppingCategory, ShoppingListItemType[]>;
  });

  const activeItemsForTab = computed(() => {
    if (activeTab.value === 'all' || !isShoppingCategory(activeTab.value)) {
      return activeItems.value;
    }
    return activeItemsByCategory.value[activeTab.value] ?? [];
  });

  const tabCounts = computed(() => {
    const counts = {
      all: activeItems.value.length,
      meat: 0,
      fruit_veg: 0,
      bakery: 0,
      canned: 0,
      other: 0,
    } as Record<ShoppingListTab, number>;

    for (const item of activeItems.value) {
      const category = isShoppingCategory(item.category) ? item.category : 'other';
      counts[category] += 1;
    }

    return counts;
  });

  const categoryLabel = (category: ShoppingCategory): string => {
    switch (category) {
      case 'meat':
        return t('Meat');
      case 'fruit_veg':
        return t('Fruit & Veg');
      case 'bakery':
        return t('Bakery');
      case 'canned':
        return t('Canned');
      case 'other':
        return t('Other');
      default:
        return category;
    }
  };

  const handleInputFocus = async (event: FocusEvent) => {
    const { scrollToInput } = useMobileInputScroll();
    const target = event.target as HTMLElement | null;
    if (target) {
      scrollToInput(target);
    }

    if (import.meta.client) {
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (Capacitor.isNativePlatform() && /Android/i.test(navigator.userAgent)) {
          setTimeout(() => {
            if (target) {
              target.scrollIntoView({
                behavior: 'auto',
                block: 'center',
                inline: 'nearest'
              });
            }
          }, 600);
        }
      } catch (error) {
        console.warn('Could not import Capacitor:', error);
      }
    }
  };

  const handleAddNewItem = async () => {
    if (!newItemName.value.trim()) {
      return;
    }
    try {
      const category =
        activeTab.value === 'all'
          ? categorizeShoppingItemName(newItemName.value)
          : activeTab.value;

      await shoppingListStore.addItem({
        name: newItemName.value,
        category,
      });
      track('shopping_list_item_added');
      newItemName.value = '';
      await nextTick();
      newItemInput.value?.focus();
    } catch (error) {
      console.error('Error adding item:', error);
    }
  };

  const handleItemUpdate = async (event: { id: number | string; name: string; checked?: boolean }) => {
    if (!event?.id) {
      return;
    }

    if (event.checked !== undefined) {
      await shoppingListStore.setItemChecked(event.id, event.checked, event.name);
      if (event.checked) {
        track('shopping_list_item_checked');
      }
      return;
    }

    await shoppingListStore.updateItem(event.id, {
      name: event.name,
    });
  };

  const handleMoveCategory = async (event: { id: number | string; category: string }) => {
    await shoppingListStore.moveItemToCategory(event.id, event.category);
  };

  const handleReorder = async (
    category: ShoppingListTab,
    orderedIds: Array<number | string>
  ) => {
    if (!isShoppingCategory(category)) {
      return;
    }

    const categoryItems = activeItemsByCategory.value[category] ?? [];
    const byId = new Map(categoryItems.map((item) => [item.id, item]));
    const reordered = orderedIds
      .map((id) => byId.get(id))
      .filter((item): item is ShoppingListItemType => !!item)
      .map((item, index) => ({ ...item, position: index, category }));

    shoppingListStore.applyActiveFlatOrder(reordered);
    await shoppingListStore.syncPendingChanges();
  };

  const handleUncheckAll = async () => {
    const snapshot = await shoppingListStore.uncheckAllCheckedItems();
    const previouslyChecked = snapshot.filter(item => item.checked);
    if (previouslyChecked.length) {
      showActionToast(t('Items unchecked'), {
        label: t('Undo'),
        handler: async () => {
          await shoppingListStore.applyBulkItemUpdates(
            previouslyChecked.map(item => ({ id: item.id, checked: true }))
          );
        }
      });
    }
  };

  const handleDeleteAllChecked = async () => {
    const snapshot = await shoppingListStore.deleteAllCheckedItems();
    track('shopping_list_item_deleted');
    if (snapshot.length) {
      showActionToast(t('Items deleted'), {
        label: t('Undo'),
        handler: async () => {
          await shoppingListStore.restoreItems(snapshot);
        }
      });
    }
  };

  const handleRemoveItem = async (itemId: number | string) => {
    const snapshot = shoppingListStore.shoppingList?.items.find(item => item.id === itemId);
    const snapshotCopy = snapshot ? { ...snapshot } : null;
    await shoppingListStore.deleteItem(itemId);
    track('shopping_list_item_deleted');
    if (snapshotCopy) {
      showActionToast(t('Item deleted'), {
        label: t('Undo'),
        handler: async () => {
          await shoppingListStore.restoreItems([snapshotCopy]);
        }
      });
    }
  };

  const handleInsertBelow = async (itemId: number | string) => {
    await shoppingListStore.insertItemAfter(itemId, '');
  };

  onMounted(async () => {
    await nextTick();
    track('shopping_list_viewed');

    await loadViewSettings();

    const loadData = async () => {
      try {
        await Promise.all([
          shoppingListStore.fetchShoppingList().catch(handleError),
          userStore.fetchUser().catch(handleError)
        ]);
      } catch (error) {
        handleError(error);
      } finally {
        loading.value = false;
      }
    };

    loadData();

    if (import.meta.client) {
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (Capacitor.isNativePlatform() && /Android/i.test(navigator.userAgent)) {
          let initialViewportHeight = window.innerHeight;

          const handleViewportResize = () => {
            const currentHeight = window.innerHeight;
            const heightDifference = initialViewportHeight - currentHeight;

            if (heightDifference > 150) {
              const focusedElement = document.activeElement;
              if (focusedElement && focusedElement.tagName === 'INPUT') {
                setTimeout(() => {
                  focusedElement.scrollIntoView({
                    behavior: 'auto',
                    block: 'center',
                    inline: 'nearest'
                  });
                }, 100);
              }
            }

            initialViewportHeight = currentHeight;
          };

          window.addEventListener('resize', handleViewportResize);

          onUnmounted(() => {
            window.removeEventListener('resize', handleViewportResize);
          });
        }
      } catch (error) {
        console.warn('Could not set up viewport resize listener:', error);
      }
    }
  });

  return {
    pullToRefreshEnabled,
    hideCheckboxes,
    hideCheckedItems,
    handlePullRefresh,
    hasData,
    activeTab,
    tabCounts,
    categories,
    activeItemsByCategory,
    categoryLabel,
    handleReorder,
    handleItemUpdate,
    handleRemoveItem,
    handleInsertBelow,
    handleMoveCategory,
    activeItemsForTab,
    handleAddNewItem,
    newItemInput,
    newItemName,
    handleInputFocus,
    hasCheckedItems,
    checkedItemsExpanded,
    checkedItems,
    handleUncheckAll,
    handleDeleteAllChecked,
  };
};

export type ShoppingListScreen = ReturnType<typeof useShoppingListScreen>;

const shoppingListScreenKey: InjectionKey<ShoppingListScreen> = Symbol('shoppingListScreen');

export const provideShoppingListScreen = () => {
  const screen = useShoppingListScreen();
  provide(shoppingListScreenKey, screen);
  return screen;
};

export const useShoppingListScreenContext = () => {
  const screen = inject(shoppingListScreenKey);
  if (!screen) {
    throw new Error('Shopping list screen is not available');
  }
  return screen;
};
