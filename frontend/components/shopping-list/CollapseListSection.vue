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
        <div class="py-2" v-if="categoryItems.length > 0">
          <div v-for="item in categoryItems" :key="item.id">
            <input 
              type="checkbox"
              class="checkbox checkbox-primary mr-2"
              @change="updateItem(item.id, item.name)"
            />
            <input 
              type="text"
              placeholder="Enter item name"
              class="input input-ghost"
              :value="item.name"
              @change="updateItem(item.id, $event.target.value)"
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
const props = defineProps({
  categoryTitle: {
    type: String,
    required: true,
  },
  categoryItems: {
    type: Array,
    required: true,
  },
})

const isOpen = ref(true);
const newItemName = ref('');

const toggleCollapse = () => {
  isOpen.value = !isOpen.value;
}

const addItem = (name) => {
  // handle new item in shopping list category
  props.categoryItems.push({
    id: props.categoryItems.length + 1,
    name: name,
  });
  newItemName.value = '';
}
</script>