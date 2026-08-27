<template>
  <div class="max-w-4xl mx-auto px-4" :class="{ 'hide-checkboxes': hideCheckboxes }">
    <PullToRefreshChrome :enabled="pullToRefreshEnabled" :on-refresh="handlePullRefresh" />
    <div class="relative flex items-center justify-center m-4">
      <h1 class="text-2xl font-bold text-center" data-testid="shopping-list-title">
        {{ $t('Shopping List') }}
      </h1>
      <div class="dropdown dropdown-end absolute right-0">
        <button
          tabindex="0"
          type="button"
          class="btn btn-ghost btn-sm btn-circle"
          data-testid="shopping-list-settings-button"
          :aria-label="$t('View settings')"
        >
          <fa icon="ellipsis-vertical" />
        </button>
        <ul
          tabindex="0"
          class="dropdown-content menu bg-base-200 rounded-box z-50 w-60 p-2 shadow"
        >
          <li>
            <label class="label cursor-pointer justify-between">
              <span class="label-text">{{ $t('Hide checked items') }}</span>
              <input
                type="checkbox"
                class="toggle toggle-primary toggle-sm"
                data-testid="shopping-list-hide-checked-toggle"
                v-model="hideCheckedItems"
              />
            </label>
          </li>
          <li>
            <label class="label cursor-pointer justify-between">
              <span class="label-text">{{ $t('Hide checkboxes') }}</span>
              <input
                type="checkbox"
                class="toggle toggle-primary toggle-sm"
                data-testid="shopping-list-hide-checkboxes-toggle"
                v-model="hideCheckboxes"
              />
            </label>
          </li>
        </ul>
      </div>
    </div>

    <ShoppingListSkeleton v-if="!hasData" />
    <div v-else>
      <ShoppingListCategoryTabs v-model="activeTab" :counts="tabCounts" />

      <div data-testid="shopping-list-active-items">
      <template v-if="activeTab === 'all'">
        <div
          v-for="category in categories"
          :key="category"
          class="mb-4"
        >
          <template v-if="activeItemsByCategory[category].length">
            <h2
              class="text-sm font-semibold uppercase tracking-wide opacity-70 px-2 mb-1"
              :data-testid="`shopping-list-section-${category}`"
            >
              {{ categoryLabel(category) }}
            </h2>
            <ShoppingListSortableList
              :items="activeItemsByCategory[category]"
              @reorder="(ids) => handleReorder(category, ids)"
            >
              <template #default="{ item }">
                <ShoppingListItem
                  v-if="item"
                  :item="item"
                  :hide-checkbox="hideCheckboxes"
                  @update="handleItemUpdate"
                  @remove="handleRemoveItem"
                  @insertBelow="handleInsertBelow"
                  @moveCategory="handleMoveCategory"
                />
              </template>
            </ShoppingListSortableList>
          </template>
        </div>
      </template>

      <ShoppingListSortableList
        v-else
        :items="activeItemsForTab"
        @reorder="(ids) => handleReorder(activeTab, ids)"
      >
        <template #default="{ item }">
          <ShoppingListItem
            v-if="item"
            :item="item"
            :hide-checkbox="hideCheckboxes"
            @update="handleItemUpdate"
            @remove="handleRemoveItem"
            @insertBelow="handleInsertBelow"
            @moveCategory="handleMoveCategory"
          />
        </template>
      </ShoppingListSortableList>
      </div>

      <div class="pt-4 flex items-center gap-2 my-2">
        <button
          class="btn btn-outline btn-primary btn-sm rounded-lg w-[1.5rem]! h-[1.5rem]!"
          type="button"
          data-testid="shopping-list-new-item-button"
          @click="handleAddNewItem"
        >
          <fa icon="plus" />
        </button>
        <input
          ref="newItemInput"
          type="text"
          :placeholder="$t('Enter new item')"
          class="input input-ghost w-full pr-5"
          data-testid="shopping-list-new-item-input"
          v-model="newItemName"
          @keyup.enter="handleAddNewItem"
          @focus="handleInputFocus"
        />
      </div>

      <div v-if="hasCheckedItems && !hideCheckedItems" class="mt-4 bg-base-200 rounded-box">
        <div class="flex items-center justify-between gap-2 px-4 py-2">
          <button
            type="button"
            class="flex items-center gap-2 text-sm font-medium min-w-0 text-left"
            data-testid="shopping-list-checked-items-toggle"
            @click="checkedItemsExpanded = !checkedItemsExpanded"
          >
            <fa
              icon="chevron-down"
              class="transition-transform duration-200 shrink-0"
              :class="{ '-rotate-90': !checkedItemsExpanded }"
            />
            <span data-testid="shopping-list-checked-items-title">
              {{ $t('Checked items') }} ({{ checkedItems.length }})
            </span>
          </button>
          <div class="flex items-center gap-1 shrink-0">
            <button
              class="btn btn-ghost btn-xs"
              type="button"
              data-testid="shopping-list-uncheck-all"
              @click="handleUncheckAll"
            >
              {{ $t('Uncheck all') }}
            </button>
            <button
              class="btn btn-ghost btn-xs text-error"
              type="button"
              data-testid="shopping-list-delete-all-checked"
              @click="handleDeleteAllChecked"
            >
              {{ $t('Delete all') }}
            </button>
          </div>
        </div>
        <div v-show="checkedItemsExpanded" class="px-2 pb-2">
          <div
            v-for="item in checkedItems"
            :key="item.id"
            class="my-1"
          >
            <ShoppingListItem
              class="flex-1"
              :item="item"
              :hide-checkbox="hideCheckboxes"
              @update="handleItemUpdate"
              @remove="handleRemoveItem"
              @insertBelow="handleInsertBelow"
              @moveCategory="handleMoveCategory"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: 'auth'
});

import { Preferences } from '@capacitor/preferences';
import {
  SHOPPING_CATEGORIES,
  categorizeShoppingItemName,
  groupShoppingListItemsByCategory,
  isShoppingCategory,
  type ShoppingCategory,
  type ShoppingListTab,
} from '@meal-diary/shared';
import ShoppingListSkeleton from '~/components/shopping-list/ShoppingListSkeleton.vue';
import ShoppingListItem from '~/components/shopping-list/ShoppingListItem.vue';
import ShoppingListCategoryTabs from '~/components/shopping-list/ShoppingListCategoryTabs.vue';
import ShoppingListSortableList from '~/components/shopping-list/ShoppingListSortableList.vue';
import PullToRefreshChrome from '~/components/PullToRefreshChrome.vue';
import { usePullToRefreshEnabled } from '~/composables/usePullToRefreshEnabled';
import { useShoppingListStore } from '~/stores/shoppingList';
import { useUserStore } from '~/stores/user';
import { flattenShoppingListItems } from '~/utils/shoppingListTree';
import type { ShoppingListItem as ShoppingListItemType } from '~/types/ShoppingList';

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
</script>

<style>
.list-enter-active,
.list-leave-active {
  transition: all 0.3s ease;
}

.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateY(30px);
}

.list-move {
  transition: transform 0.3s ease;
}

.list-item {
  transition: all 0.2s ease;
}

.input:focus {
  position: relative;
  z-index: 10;
}

.hide-checkboxes .checkbox {
  display: none;
}
</style>
