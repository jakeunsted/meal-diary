<script setup lang="ts">
import { DiaryMockup, RecipesMockup, ShoppingMockup } from '#components'

const showcases = [
  {
    icon: '📅',
    title: 'Weekly Meal Planner',
    description: "Plan breakfast, lunch and dinner for the whole week at a glance. Collapse days you've sorted, expand the ones you're working on. Your partner sees every change the moment you make it.",
    bullets: [
      'See the full week in one view',
      'Collapsible days keep it uncluttered',
      'Real-time sync with your partner',
      'Set meals in seconds',
    ],
    mockup: DiaryMockup,
    reverse: false,
  },
  {
    icon: '🔗',
    title: 'Partner Sync',
    description: "Invite your partner with a simple shareable code. Once they're in, your meal diary, recipes and shopping list are all shared. One household. One plan. Zero confusion.",
    bullets: [
      'One invite code, instant access',
      'Shared diary and recipe book',
      'Shopping list stays in sync',
      'Each person has their own avatar',
    ],
    mockup: RecipesMockup,
    reverse: true,
  },
  {
    icon: '🍽️',
    title: 'Recipe Saving',
    description: 'Save your favourite recipes and pull them straight into your weekly plan. Build a shared cookbook over time — and never draw a blank on what to cook again.',
    bullets: [
      'Save and name your own recipes',
      'See portions and ingredients',
      'Pull recipes into your meal plan',
      'Shared with your whole household',
    ],
    mockup: ShoppingMockup,
    reverse: false,
  },
]
</script>

<template>
  <div>
    <section class="relative overflow-hidden bg-base-100 px-4 py-20 text-center sm:px-6 lg:px-8">
      <div class="pointer-events-none absolute -top-20 right-0 size-96 rounded-full bg-primary/20 blur-3xl" />
      <span class="relative inline-block rounded-2xl bg-base-300 px-4 py-1.5 text-sm font-semibold text-indigo-300">
        Everything Meal Diary can do
      </span>
      <h1 class="relative mt-6 text-4xl font-extrabold text-white sm:text-5xl">Built for couples. Simple by design.</h1>
      <p class="relative mx-auto mt-5 max-w-2xl text-lg text-neutral">
        Three features that turn "what's for dinner?" into a thing of the past.
      </p>
    </section>

    <section
      v-for="(item, i) in showcases"
      :key="item.title"
      class="px-4 py-16 sm:px-6 lg:px-8"
      :class="i % 2 === 0 ? 'bg-base-200' : 'bg-base-100'"
    >
      <div
        class="mx-auto flex max-w-6xl flex-col items-center gap-12 lg:flex-row"
        :class="item.reverse ? 'lg:flex-row-reverse' : ''"
      >
        <div class="flex-1">
          <p class="text-4xl">{{ item.icon }}</p>
          <h2 class="mt-4 text-3xl font-bold text-white sm:text-4xl">{{ item.title }}</h2>
          <p class="mt-4 max-w-lg text-[17px] leading-relaxed text-neutral">{{ item.description }}</p>
          <ul class="mt-6 space-y-3">
            <li v-for="bullet in item.bullets" :key="bullet" class="flex items-center gap-3 text-[15px] text-base-content">
              <span class="size-2 rounded-full bg-primary" />
              {{ bullet }}
            </li>
          </ul>
        </div>
        <div class="flex flex-1 justify-center">
          <component :is="item.mockup" />
        </div>
      </div>
    </section>

    <CtaBand />
  </div>
</template>
