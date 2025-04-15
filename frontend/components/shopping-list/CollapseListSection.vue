<template>
  <div>
    <div 
      tabindex="0" 
      class="collapse"
      :class="{ 'collapse-open': isOpen, 'collapse-close': !isOpen }"
    >
      <div 
        class="collapse-title flex justify-between bg-base-200 items-center px-6"
        @click="toggleCollapse"
      >
        <div class="font-semibold">{{ categoryTitle }}</div>
        <fa :icon="isOpen ? 'chevron-up' : 'chevron-down'" />
      </div>
      <div class="collapse-content bg-base-300 text-sm">
        <div class="py-2" v-if="categoryItems.length > 0" v-auto-animate>
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
        <div class="">
          <button 
            class="btn btn-outline btn-primary btn-sm rounded-lg mr-2 w-[1.5rem]! h-[1.5rem]!"
            @click="addItem(newItemName)"
            v-on:keyup.enter="addItem(newItemName)"
          >
            <fa icon="plus" />
          </button>
          <input 
            type="text"
            placeholder="Enter new item"
            class="input input-ghost"
            v-model="newItemName"
            v-on:keyup.enter="addItem(newItemName)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
const emit = defineEmits(['addItem', 'updateItem']);

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
  
  props.categoryItems.push({
    id: props.categoryItems.length + 1,
    name: name,
    checked: false,
  });
  newItemName.value = '';

  emit('addItem', {
    category: props.categoryTitle,
    itemName: name,
  });
};

const handleItemUpdate = (itemData) => {
  updateItem(itemData.id, itemData.name, itemData.checked);
};

const updateItem = (id, name, checked) => {
  const item = props.categoryItems.find(item => item.id === id);
  if (!item) return;
  
  if (checked !== undefined) {
    item.checked = !item.checked;
  } else {
    item.name = name;
  }
  
  props.categoryItems.splice(props.categoryItems.indexOf(item), 1, item);

  emit('updateItem', {
    category: props.categoryTitle,
    itemName: name,
    itemChecked: item.checked
  });
};

const removeItem = (id) => {
  const item = props.categoryItems.find(item => item.id === id);
  if (!item) return;
  
  props.categoryItems.splice(props.categoryItems.indexOf(item), 1);

  emit('updateItem', {
    category: props.categoryTitle,
    itemName: item.name,
    itemChecked: false
  });
};
</script>