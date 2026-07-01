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
      <DnDProvider>
        <template #preview>
          <DragPreview />
        </template>
        <ShoppingListDndZone
          :active-items="activeItems"
          :item-depth-map="itemDepthMap"
          @update="handleItemUpdate"
          @remove="handleRemoveItem"
          @indent="handleIndent"
          @outdent="handleOutdent"
          @insertBelow="handleInsertBelow"
        />

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
              <div
                class="flex items-center gap-2"
                :style="{ marginLeft: `${(itemDepthMap[item.id] || 0) * 1.5}rem` }"
              >
                <ShoppingListItem
                  class="flex-1"
                  :item="item"
                  @update="handleItemUpdate"
                  @remove="handleRemoveItem"
                  @indent="handleIndent"
                  @outdent="handleOutdent"
                  @insertBelow="handleInsertBelow"
                />
              </div>
            </div>
          </div>
        </div>
      </DnDProvider>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: 'auth'
});

import { Preferences } from '@capacitor/preferences';
import { DnDProvider, DragPreview } from '@vue-dnd-kit/core';
import ShoppingListSkeleton from '~/components/shopping-list/ShoppingListSkeleton.vue';
import ShoppingListItem from '~/components/shopping-list/ShoppingListItem.vue';
import ShoppingListDndZone from '~/components/shopping-list/ShoppingListDndZone.vue';
import PullToRefreshChrome from '~/components/PullToRefreshChrome.vue';
import { usePullToRefreshEnabled } from '~/composables/usePullToRefreshEnabled';
import { useShoppingListStore } from '~/stores/shoppingList';
import { useUserStore } from '~/stores/user';
import { flattenShoppingListItems } from '~/utils/shoppingListTree';

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
  return orderedItems.value.filter(item => item.checked);
});

const hasCheckedItems = computed(() => checkedItems.value.length > 0);

const itemDepthMap = computed<Record<number, number>>(() => {
  const depthMap: Record<number, number> = {};
  const items = shoppingListStore.shoppingList?.items || [];
  const byId = new Map<number, { id: number; parent_item_id: number | null }>();

  for (const item of items) {
    if (typeof item.id === 'number') {
      byId.set(item.id, { id: item.id, parent_item_id: item.parent_item_id });
    }
  }

  const computeDepth = (id: number, visited: Set<number>): number => {
    if (depthMap[id] !== undefined) {
      return depthMap[id];
    }
    if (visited.has(id)) {
      return 0;
    }
    visited.add(id);
    const entry = byId.get(id);
    if (!entry || entry.parent_item_id === null) {
      depthMap[id] = 0;
      return 0;
    }
    const parentDepth = computeDepth(entry.parent_item_id, visited);
    const depth = parentDepth + 1;
    depthMap[id] = depth;
    return depth;
  };

  for (const entry of byId.values()) {
    computeDepth(entry.id, new Set<number>());
  }

  return depthMap;
});

// Add function to handle input focus
const handleInputFocus = async (event: FocusEvent) => {
  // Use the improved mobile input scroll functionality
  const { scrollToInput } = useMobileInputScroll();
  const target = event.target as HTMLElement | null;
  if (target) {
    scrollToInput(target);
  }

  // For Capacitor Android, also ensure the input is visible
  if (import.meta.client) {
    try {
      const { Capacitor } = await import('@capacitor/core');
      if (Capacitor.isNativePlatform() && /Android/i.test(navigator.userAgent)) {
        // Additional scroll to ensure input is visible
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
    await shoppingListStore.addItem({
      name: newItemName.value,
      parentItemId: null
    });
    track('shopping_list_item_added');
    newItemName.value = '';
    // Refocus the input so multiple items can be entered in sequence (Keep behavior)
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

const handleIndent = async (itemId: number | string) => {
  await shoppingListStore.indentItem(itemId);
};

const handleOutdent = async (itemId: number | string) => {
  await shoppingListStore.outdentItem(itemId);
};

const handleInsertBelow = async (itemId: number | string) => {
  await shoppingListStore.insertItemAfter(itemId, '');
};

onMounted(async () => {
  await nextTick();
  track('shopping_list_viewed');

  // Load persisted view settings (hide checked items / hide checkboxes)
  await loadViewSettings();

  // Start loading data after skeleton is visible
  const loadData = async () => {
    try {
      // Start all requests in parallel
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

  // Start loading data
  loadData();

  // Add viewport resize listener for keyboard handling
  if (import.meta.client) {
    try {
      const { Capacitor } = await import('@capacitor/core');
      if (Capacitor.isNativePlatform() && /Android/i.test(navigator.userAgent)) {
        let initialViewportHeight = window.innerHeight;

        const handleViewportResize = () => {
          const currentHeight = window.innerHeight;
          const heightDifference = initialViewportHeight - currentHeight;

          // If viewport height decreased significantly, keyboard likely opened
          if (heightDifference > 150) {
            // Find focused input and scroll to it
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

        // Cleanup on unmount
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

/* Ensure inputs are properly positioned when keyboard opens */
.input:focus {
  position: relative;
  z-index: 10;
}

:deep(.dnd-kit-preview) {
  opacity: 0.7;
}

/* When "Hide checkboxes" is enabled, hide the item checkboxes across the list */
.hide-checkboxes .checkbox {
  display: none;
}
</style>

