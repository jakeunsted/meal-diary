<template>
  <div class="max-w-4xl mx-auto px-4">
    <PullToRefreshChrome :enabled="pullToRefreshEnabled" />
    <h1 class="text-2xl font-bold text-center m-4" data-testid="shopping-list-title">
      {{ $t('Shopping List') }}
    </h1>

    <ShoppingListSkeleton v-if="!hasData" />
    <div v-else>
      <DnDProvider>
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
          type="text"
          :placeholder="$t('Enter new item')"
          class="input input-ghost w-full pr-5"
          data-testid="shopping-list-new-item-input"
          v-model="newItemName"
          @keyup.enter="handleAddNewItem"
          @focus="handleInputFocus"
        />
      </div>

        <div v-if="hasCheckedItems" class="mt-4">
          <div class="collapse collapse-arrow bg-base-200">
            <input type="checkbox" />
            <div class="collapse-title text-sm font-medium" data-testid="shopping-list-checked-items-title">
              {{ $t('Checked items') }} ({{ checkedItems.length }})
            </div>
            <div class="collapse-content">
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
        </div>
      </DnDProvider>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: 'auth'
});

import { DnDProvider } from '@vue-dnd-kit/core';
import ShoppingListSkeleton from '~/components/shopping-list/ShoppingListSkeleton.vue';
import ShoppingListItem from '~/components/shopping-list/ShoppingListItem.vue';
import ShoppingListDndZone from '~/components/shopping-list/ShoppingListDndZone.vue';
import PullToRefreshChrome from '~/components/PullToRefreshChrome.vue';
import { usePullToRefreshEnabled } from '~/composables/usePullToRefreshEnabled';
import { useShoppingListStore } from '~/stores/shoppingList';
import { useUserStore } from '~/stores/user';

const { pullToRefreshEnabled } = usePullToRefreshEnabled();
const shoppingListStore = useShoppingListStore();
const userStore = useUserStore();

const loading = ref(true);
const hasData = computed(() => {
  return !loading.value && !!shoppingListStore.shoppingList;
});

const newItemName = ref('');

const handleError = (error: unknown) => {
  console.error('Error in shopping list page:', error);
};

const orderedItems = computed(() => {
  if (!shoppingListStore.shoppingList?.items) {
    return [];
  }
  return [...shoppingListStore.shoppingList.items].sort((a, b) => a.position - b.position);
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
    newItemName.value = '';
  } catch (error) {
    console.error('Error adding item:', error);
  }
};

const handleItemUpdate = async (event: { id: number | string; name: string; checked?: boolean }) => {
  if (!event?.id) {
    return;
  }
  await shoppingListStore.updateItem(event.id, {
    name: event.name,
    checked: event.checked ?? false
  });
};

const handleRemoveItem = async (itemId: number | string) => {
  await shoppingListStore.deleteItem(itemId);
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
</style>

