<template>
  <div class="w-full max-w-[520px] overflow-hidden rounded-2xl bg-base-300 shadow-2xl">
    <div class="px-6 pt-5">
      <p class="text-xl font-bold text-white">Recipe Book</p>
    </div>

    <div class="mt-4 flex gap-2 px-4">
      <div class="flex-1 rounded-md border border-base-200 bg-base-100 px-3 py-2 text-sm text-neutral">Search recipes...</div>
      <div class="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white">+ New Recipe</div>
    </div>

    <div class="mt-3 space-y-2 px-4">
      <div class="flex items-center justify-between rounded-md bg-base-200 px-3 py-2.5">
        <span class="text-sm font-bold text-white">Chicken Curry (tomato and coconut)</span>
        <span class="text-right text-xs text-neutral">7 portions<br>7 ingredients</span>
      </div>
      <div class="flex items-center justify-between rounded-md bg-base-200 px-3 py-2.5">
        <span class="text-sm font-bold text-white">Chilli Con Carne</span>
        <span class="text-right text-xs text-neutral">7 portions<br>5 ingredients</span>
      </div>
    </div>

    <div class="mt-6 flex items-center justify-around border-t border-base-200 py-3 text-xs">
      <span class="font-semibold text-indigo-300">🏠 Home</span>
      <span class="text-neutral">📖 Recipes</span>
      <span class="text-neutral">🛒 Shopping</span>
      <span class="text-neutral">👤 Profile</span>
    </div>
  </div>
</template>
