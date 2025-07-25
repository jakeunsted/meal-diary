<template>
  <div class="animate-fade-in">
    <div 
      tabindex="0" 
      class="collapse"
      :class="{ 'collapse-open': isOpen, 'collapse-close': !isOpen }"
    >
      <div 
        class="collapse-title flex justify-between bg-base-200 items-center px-2"
        @click="toggleCollapse"
        @touchstart="handlePressStart"
        @touchend="handlePressEnd"
        @touchcancel="handlePressEnd"
        @mousedown="handlePressStart"
        @mouseup="handlePressEnd"
        @mouseleave="handlePressEnd"
      >
        <div class="flex items-center gap-2">
          <div class="font-semibold ml-2">{{ categoryTitle }}</div>
        </div>
        <fa :icon="isOpen ? 'chevron-up' : 'chevron-down'" class="pr-1" />
      </div>
      <div class="collapse-content bg-base-300 text-sm mb-2 rounded-b-lg">
        <div class="pt-2" v-if="categoryItems.length > 0" v-auto-animate>
          <div 
            v-for="item in sortedItems" 
            :key="item.id"
          >
            <ShoppingListItem 
              :item="item" 
              @update="handleItemUpdate" 
              @remove="removeItem"
            />
          </div>
        </div>
        <div class="pt-2 flex items-center gap-2">
          <button 
            class="btn btn-outline btn-primary btn-sm rounded-lg w-[1.5rem]! h-[1.5rem]!"
            @click="addItem(newItemName)"
            v-on:keyup.enter="addItem(newItemName)"
          >
            <fa icon="plus" />
          </button>
          <input 
            type="text"
            :placeholder="$t('Enter new item')"
            class="input input-ghost w-full pr-5"
            v-model="newItemName"
            v-on:keyup.enter="addItem(newItemName)"
            @focus="handleNewItemInputFocus"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
const emit = defineEmits(['addItem', 'updateItem', 'longPress', 'inputFocus']);

const props = defineProps({
  categoryTitle: {
    type: String,
    required: true,
    default: () => '',
  },
  categoryItems: {
    type: Array,
    required: true,
    default: () => [],
  },
});

const isOpen = ref(true);
const newItemName = ref('');
let pressTimer = null;
const LONG_PRESS_DURATION = 500; // 500ms for long press

// Add mobile input scroll functionality
const { handleInputFocus } = useMobileInputScroll();

const handlePressStart = () => {
  pressTimer = setTimeout(() => {
    emit('longPress');
  }, LONG_PRESS_DURATION);
};

const handlePressEnd = () => {
  if (pressTimer) {
    clearTimeout(pressTimer);
    pressTimer = null;
  }
};

// Add computed property to sort items
const sortedItems = computed(() => {
  return [...props.categoryItems].sort((a, b) => {
    if (a.checked === b.checked) return 0;
    return a.checked ? 1 : -1;
  });
});

const toggleCollapse = () => {
  isOpen.value = !isOpen.value;
};

const addItem = (name) => {
  if (!name.trim()) return;
  
  emit('addItem', {
    category: props.categoryTitle,
    itemName: name,
  });
  newItemName.value = '';
};

const handleItemUpdate = (itemData) => {
  emit('updateItem', {
    id: itemData.id,
    category: props.categoryTitle,
    itemName: itemData.name,
    itemChecked: itemData.checked
  });
};

const removeItem = (id) => {
  const item = props.categoryItems.find(item => item.id === id);
  if (!item) return;
  
  emit('removeItem', {
    category: props.categoryTitle,
    itemName: item.name,
    itemChecked: false
  });
};

const handleNewItemInputFocus = (event) => {
  handleInputFocus(event);
  emit('inputFocus', event);
};
</script>

<style>
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fade-in {
  animation: fadeIn 0.3s ease-out;
}
</style>