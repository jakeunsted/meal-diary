<template>
  <div
    class="flex h-full min-h-0 flex-col"
    :class="{ 'hide-checkboxes': hideCheckboxes }"
    :data-testid="`shopping-list-panel-${variant}`"
  >
    <div class="relative flex shrink-0 items-center justify-center px-3 pt-3">
      <h2 class="text-lg font-bold text-center" data-testid="shopping-list-title">
        {{ $t('Shopping List') }}
      </h2>
      <div class="dropdown dropdown-end absolute right-3">
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

    <div class="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
      <ShoppingListSkeleton v-if="!hasData" />
      <div v-else>
        <ShoppingListCategoryTabs v-model="activeTab" :counts="tabCounts" />

        <ShoppingListWide v-if="variant === 'wide'" />
        <ShoppingListCompact v-else />

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

        <div v-if="hasCheckedItems && !hideCheckedItems" class="mt-4 bg-base-100 rounded-box">
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
  </div>
</template>

<script setup lang="ts">
import ShoppingListSkeleton from '~/components/shopping-list/ShoppingListSkeleton.vue';
import ShoppingListItem from '~/components/shopping-list/ShoppingListItem.vue';
import ShoppingListCategoryTabs from '~/components/shopping-list/ShoppingListCategoryTabs.vue';
import ShoppingListCompact from '~/components/shopping-list/ShoppingListCompact.vue';
import ShoppingListWide from '~/components/shopping-list/ShoppingListWide.vue';

defineProps<{
  variant: 'compact' | 'wide';
}>();

const {
  hideCheckboxes,
  hideCheckedItems,
  hasData,
  activeTab,
  tabCounts,
  handleItemUpdate,
  handleRemoveItem,
  handleInsertBelow,
  handleMoveCategory,
  handleAddNewItem,
  newItemInput,
  newItemName,
  handleInputFocus,
  hasCheckedItems,
  checkedItemsExpanded,
  checkedItems,
  handleUncheckAll,
  handleDeleteAllChecked,
} = provideShoppingListScreen();
</script>

<style>
.hide-checkboxes .checkbox {
  display: none;
}
</style>
