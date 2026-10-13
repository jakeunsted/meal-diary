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
import ShoppingListSkeleton from '~/components/shopping-list/ShoppingListSkeleton.vue';
import ShoppingListItem from '~/components/shopping-list/ShoppingListItem.vue';
import ShoppingListCategoryTabs from '~/components/shopping-list/ShoppingListCategoryTabs.vue';
import ShoppingListSortableList from '~/components/shopping-list/ShoppingListSortableList.vue';
import PullToRefreshChrome from '~/components/PullToRefreshChrome.vue';

const {
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
} = useShoppingListScreen();
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
