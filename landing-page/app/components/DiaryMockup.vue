<template>
  <div class="w-full max-w-[520px] overflow-hidden rounded-2xl bg-base-300 shadow-2xl">
    <div class="px-6 pt-5 text-center">
      <p class="text-2xl font-bold text-white">Meal diary</p>
      <p class="mt-1 text-sm text-neutral">Week Selection</p>
    </div>

    <div class="mt-4 flex items-center gap-2 px-4">
      <button class="flex size-8 items-center justify-center rounded-md bg-primary font-bold text-white">‹</button>
      <div class="flex-1 rounded-md border border-base-200 bg-base-100 px-3 py-2 text-sm text-white">
        Week 26 (22/06/2026 – 28/06/2026)
      </div>
      <button class="flex size-8 items-center justify-center rounded-md bg-primary font-bold text-white">›</button>
    </div>

    <div class="mt-3 space-y-px px-4">
      <div class="flex items-center justify-between rounded-md border border-base-200 bg-base-100 px-3 py-2">
        <span class="text-sm font-bold text-white">Monday - 22 Jun</span>
        <span class="text-neutral">∨</span>
      </div>
      <div class="flex items-center justify-between rounded-md border border-base-200 bg-base-100 px-3 py-2">
        <span class="text-sm font-bold text-white">Tuesday - 23 Jun</span>
        <span class="text-neutral">∨</span>
      </div>

      <div class="bg-base-200 px-3 py-2">
        <div class="flex items-center justify-between">
          <span class="text-sm font-bold text-white">Friday - 26 Jun</span>
          <span class="text-neutral">∧</span>
        </div>
        <div class="mt-2 flex items-center justify-between border-t border-base-content/10 py-1.5">
          <span class="text-xs text-neutral">Breakfast</span>
          <span class="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white">Eggs and beans</span>
        </div>
        <div class="flex items-center justify-between border-t border-base-content/10 py-1.5">
          <span class="text-xs text-neutral">Lunch</span>
          <span class="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white">Chicken pita</span>
        </div>
        <div class="flex items-center justify-between border-t border-base-content/10 py-1.5">
          <span class="text-xs text-neutral">Dinner</span>
          <span class="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white">Gyros/ shawarma</span>
        </div>
      </div>

      <div class="bg-base-200 px-3 py-2">
        <div class="flex items-center justify-between">
          <span class="text-sm font-bold text-white">Saturday - 27 Jun</span>
          <span class="text-neutral">∧</span>
        </div>
        <div class="mt-2 flex items-center justify-between border-t border-base-content/10 py-1.5">
          <span class="text-xs text-neutral">Breakfast</span>
          <span class="text-xs text-neutral-content">Set Meal +</span>
        </div>
        <div class="flex items-center justify-between border-t border-base-content/10 py-1.5">
          <span class="text-xs text-neutral">Dinner</span>
          <span class="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white">Leftover risotto?</span>
        </div>
      </div>
    </div>

    <div class="mt-4 flex items-center justify-around border-t border-base-200 py-3 text-xs">
      <span class="font-semibold text-indigo-300">🏠 Home</span>
      <span class="text-neutral">📖 Recipes</span>
      <span class="text-neutral">🛒 Shopping</span>
      <span class="text-neutral">👤 Profile</span>
    </div>
  </div>
</template>
