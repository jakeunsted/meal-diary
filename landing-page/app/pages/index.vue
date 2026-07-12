<script setup lang="ts">
const { public: { appUrl } } = useRuntimeConfig()

const features = [
  { icon: '📅', title: 'Weekly Meal Planner', description: "Plan breakfast, lunch and dinner for the whole week at a glance. Collapse days you've sorted, expand the ones you're working on." },
  { icon: '🔗', title: 'Partner Sync', description: 'Invite your partner with one shareable code. Your diary, recipes and shopping list stay perfectly in sync — in real time.' },
  { icon: '🍽️', title: 'Recipe Saving', description: 'Save your favourite recipes and pull them straight into your weekly plan. Build a shared cookbook over time.' },
]

const steps = [
  { number: 1, title: 'Create your account', description: 'Sign up free in 30 seconds. No credit card, no commitment.' },
  { number: 2, title: 'Invite your partner', description: 'Share your unique code. They join your shared diary instantly.' },
  { number: 3, title: 'Plan this week', description: 'Add meals together. Your partner sees updates in real time.' },
]

const posts = [
  { tag: 'Meal Planning', title: '7 Meal Planning Mistakes Couples Make (And How to Fix Them)', readTime: '5 min read' },
  { tag: 'Budgeting', title: 'How We Cut Our Weekly Food Bill by £40 With One Simple Change', readTime: '4 min read' },
  { tag: 'Recipes', title: '10 Easy Weeknight Dinners That Both of You Will Actually Want', readTime: '6 min read' },
]
</script>

<template>
  <div>
    <!-- Hero -->
    <section class="relative overflow-hidden bg-base-100">
      <div class="pointer-events-none absolute -left-20 -top-16 size-96 rounded-full bg-primary/20 blur-3xl" />
      <div class="pointer-events-none absolute right-0 top-1/3 size-72 rounded-full bg-success/10 blur-3xl" />

      <div class="relative mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:items-center lg:py-24 lg:px-8">
        <div>
          <span class="inline-block rounded-2xl bg-base-300 px-3 py-1.5 text-sm font-semibold text-indigo-300">
            Free meal planning app for couples
          </span>
          <h1 class="mt-6 text-4xl font-extrabold leading-tight text-white sm:text-5xl lg:text-6xl">
            Plan your meals together. Finally.
          </h1>
          <p class="mt-6 max-w-lg text-lg leading-relaxed text-base-content">
            Meal Diary lets couples plan the week's meals, save recipes, and stay in sync — no more "what's for dinner?" stress.
          </p>
          <div class="mt-8 flex flex-wrap items-center gap-6">
            <a :href="appUrl" class="rounded-xl bg-success px-7 py-3.5 text-base font-bold text-success-content hover:opacity-90">
              Start Free Trial →
            </a>
            <a href="#how-it-works" class="text-sm font-medium text-neutral hover:text-base-content">See how it works</a>
          </div>
          <p class="mt-6 text-sm text-neutral-content">7-day free trial · No credit card · Works in any browser</p>
        </div>

        <div class="flex justify-center lg:justify-end">
          <DiaryMockup />
        </div>
      </div>
    </section>

    <!-- Proof bar -->
    <section class="border-y border-base-200 bg-base-300">
      <div class="mx-auto grid max-w-6xl grid-cols-2 gap-y-6 px-4 py-8 sm:px-6 lg:grid-cols-4 lg:divide-x lg:divide-base-200 lg:px-8">
        <div class="lg:px-6">
          <p class="text-2xl font-bold text-indigo-300">2,400+</p>
          <p class="mt-1 text-sm text-base-content">Couples planning together</p>
        </div>
        <div class="lg:px-6">
          <p class="text-2xl font-bold text-indigo-300">7 days</p>
          <p class="mt-1 text-sm text-base-content">Free trial, no card needed</p>
        </div>
        <div class="lg:px-6">
          <p class="text-2xl font-bold text-indigo-300">4.8 ★</p>
          <p class="mt-1 text-sm text-base-content">Average user rating</p>
        </div>
        <div class="lg:px-6">
          <p class="text-2xl font-bold text-success">Free</p>
          <p class="mt-1 text-sm text-base-content">To get started today</p>
        </div>
      </div>
    </section>

    <!-- Features -->
    <section class="bg-base-200 px-4 py-20 sm:px-6 lg:px-8">
      <div class="mx-auto max-w-3xl text-center">
        <h2 class="text-3xl font-bold text-white sm:text-4xl">Everything you need to eat well together</h2>
        <p class="mt-4 text-lg text-neutral">Three features that make shared meal planning something you actually enjoy.</p>
      </div>
      <div class="mx-auto mt-12 grid max-w-6xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <FeatureCard v-for="feature in features" :key="feature.title" v-bind="feature" />
      </div>
    </section>

    <!-- How it works -->
    <section id="how-it-works" class="bg-base-100 px-4 py-20 sm:px-6 lg:px-8">
      <div class="mx-auto max-w-3xl text-center">
        <h2 class="text-3xl font-bold text-white sm:text-4xl">Up and running in 3 minutes</h2>
        <p class="mt-4 text-lg text-neutral">No tutorials. Just add your partner and start planning.</p>
      </div>
      <div class="relative mx-auto mt-14 grid max-w-4xl gap-10 sm:grid-cols-3">
        <div class="absolute left-[16%] right-[16%] top-[26px] hidden h-px bg-neutral/30 sm:block" />
        <StepItem v-for="step in steps" :key="step.number" v-bind="step" />
      </div>
    </section>

    <!-- Blog preview -->
    <section class="bg-base-300 px-4 py-20 sm:px-6 lg:px-8">
      <div class="mx-auto max-w-3xl text-center">
        <h2 class="text-3xl font-bold text-white sm:text-4xl">Tips for couples who cook</h2>
        <p class="mt-4 text-lg text-neutral">Practical advice on meal planning, saving money, and eating well together.</p>
      </div>
      <div class="mx-auto mt-12 grid max-w-6xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <BlogCard v-for="post in posts" :key="post.title" v-bind="post" />
      </div>
    </section>

    <CtaBand variant="gradient" />
  </div>
</template>
