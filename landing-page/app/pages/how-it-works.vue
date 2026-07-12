<script setup lang="ts">
import { DiaryMockup, RecipesMockup, ShoppingMockup } from '#components'

const steps = [
  {
    number: 1,
    icon: '✉️',
    title: 'Create your account',
    subtitle: '30 seconds to sign up',
    description: 'Register with your email or sign in with Google. No credit card, no commitment. You get a full 7-day Premium trial included from the moment you join.',
    bullets: ['Takes under 30 seconds', 'Email or Google sign-in', '7-day Premium trial, no card needed'],
    mockup: DiaryMockup,
    reverse: false,
  },
  {
    number: 2,
    icon: '🔗',
    title: 'Invite your partner',
    subtitle: 'One code, instant access',
    description: "Find your unique family group code on your Profile page. Share it with your partner — they join your shared diary, recipes and shopping list the moment they register.",
    bullets: ['Code found on your Profile page', 'Share via message or just copy it', 'Partner joins instantly, no approval needed'],
    mockup: RecipesMockup,
    reverse: true,
  },
  {
    number: 3,
    icon: '📅',
    title: 'Plan this week',
    subtitle: 'Your first plan in minutes',
    description: 'Open the Meal Diary and tap any day to expand it. Set Breakfast, Lunch and Dinner for each day. Your partner sees every change in real time — no refreshing required.',
    bullets: ['Tap any day to expand it', 'Set all three meal slots', "Partner's changes appear instantly"],
    mockup: DiaryMockup,
    reverse: false,
  },
  {
    number: 4,
    icon: '🛒',
    title: 'Build your shopping list',
    subtitle: 'Everything in one place',
    description: 'Add items to your shared Shopping List as you plan. Organise by category, tick things off as you shop, and never forget an ingredient again.',
    bullets: ['Add items manually or from recipes', 'Tick off as you shop', 'Shared with your partner live'],
    mockup: ShoppingMockup,
    reverse: true,
  },
]

const faqs = [
  { q: 'Is Meal Diary free?', a: "Yes — there's a generous free tier. Premium (£4.99/month per household) adds unlimited recipes, meal history and priority support. Try it free for 7 days." },
  { q: 'How do I invite my partner?', a: 'Go to your Profile page and share your unique family group code. Your partner enters it when they register and is instantly added to your shared diary.' },
  { q: 'Can I use it on my phone?', a: 'Meal Diary is a web app that works great on any mobile browser. Go to app.mealdiary.co.uk — no download needed.' },
  { q: 'What happens after the 7-day trial?', a: 'You drop to the free tier automatically. No charges, no card needed upfront. Upgrade to Premium any time from your profile.' },
]
</script>

<template>
  <div>
    <section class="relative overflow-hidden bg-base-100 px-4 py-20 text-center sm:px-6 lg:px-8">
      <div class="pointer-events-none absolute -left-24 -top-20 size-96 rounded-full bg-primary/20 blur-3xl" />
      <span class="relative inline-block rounded-2xl bg-base-300 px-4 py-1.5 text-sm font-semibold text-indigo-300">
        Get started in minutes
      </span>
      <h1 class="relative mt-6 text-4xl font-extrabold text-white sm:text-5xl">Simple from day one.</h1>
      <p class="relative mx-auto mt-5 max-w-2xl text-lg text-neutral">
        No tutorials. No setup headaches. Three steps and you're planning your first week.
      </p>
    </section>

    <section
      v-for="(step, i) in steps"
      :key="step.number"
      class="border-t border-base-200 px-4 py-16 sm:px-6 lg:px-8"
      :class="i % 2 === 0 ? 'bg-base-200' : 'bg-base-100'"
    >
      <div
        class="mx-auto flex max-w-6xl flex-col items-center gap-12 lg:flex-row"
        :class="step.reverse ? 'lg:flex-row-reverse' : ''"
      >
        <div class="flex-1">
          <div class="flex items-center gap-4">
            <span class="flex size-12 items-center justify-center rounded-full bg-primary text-lg font-bold text-white">
              {{ step.number }}
            </span>
            <span class="text-3xl">{{ step.icon }}</span>
          </div>
          <h2 class="mt-5 text-2xl font-bold text-white sm:text-3xl">{{ step.title }}</h2>
          <p class="mt-1 text-sm font-semibold text-indigo-300">{{ step.subtitle }}</p>
          <p class="mt-4 max-w-lg text-[17px] leading-relaxed text-neutral">{{ step.description }}</p>
          <ul class="mt-6 space-y-3">
            <li v-for="bullet in step.bullets" :key="bullet" class="flex items-center gap-3 text-[15px] text-base-content">
              <span class="size-2 rounded-full bg-primary" />
              {{ bullet }}
            </li>
          </ul>
        </div>
        <div class="flex flex-1 justify-center">
          <component :is="step.mockup" />
        </div>
      </div>
    </section>

    <section class="bg-base-300 px-4 py-20 sm:px-6 lg:px-8">
      <h2 class="text-center text-3xl font-bold text-white sm:text-4xl">Common questions</h2>
      <div class="mx-auto mt-10 grid max-w-4xl gap-3 sm:grid-cols-2">
        <div v-for="faq in faqs" :key="faq.q" class="collapse-arrow collapse bg-base-200">
          <input type="checkbox" />
          <div class="collapse-title text-[15px] font-semibold text-white">{{ faq.q }}</div>
          <div class="collapse-content text-sm text-neutral">{{ faq.a }}</div>
        </div>
      </div>
    </section>

    <CtaBand />
  </div>
</template>
