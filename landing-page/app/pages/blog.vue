<script setup lang="ts">
const categories = ['All', 'Meal Planning', 'Budgeting', 'Recipes', 'Shopping']
const activeCategory = ref('All')

const posts = [
  { tag: 'Budgeting', title: 'How We Cut Our Weekly Food Bill by £40 With One Simple Change', readTime: '4 min read' },
  { tag: 'Recipes', title: '10 Easy Weeknight Dinners That Both of You Will Actually Want', readTime: '6 min read' },
  { tag: 'Meal Planning', title: 'Why Sunday Meal Planning is the Best Habit We Ever Started', readTime: '3 min read' },
  { tag: 'Shopping', title: "How to Write a Shopping List You'll Actually Stick To", readTime: '5 min read' },
  { tag: 'Recipes', title: '5 Batch Cook Recipes That Last the Whole Week', readTime: '7 min read' },
  { tag: 'Budgeting', title: "The Real Cost of Not Meal Planning (It's More Than You Think)", readTime: '4 min read' },
]

const filteredPosts = computed(() =>
  activeCategory.value === 'All' ? posts : posts.filter(p => p.tag === activeCategory.value)
)

const subscribed = ref(false)
</script>

<template>
  <div>
    <section class="relative overflow-hidden bg-base-100 px-4 py-20 text-center sm:px-6 lg:px-8">
      <div class="pointer-events-none absolute -top-24 right-0 size-96 rounded-full bg-primary/20 blur-3xl" />
      <span class="relative inline-block rounded-2xl bg-base-300 px-4 py-1.5 text-sm font-semibold text-indigo-300">
        Tips, guides &amp; ideas
      </span>
      <h1 class="relative mt-6 text-4xl font-extrabold text-white sm:text-5xl">The Meal Diary Blog</h1>
      <p class="relative mx-auto mt-5 max-w-2xl text-lg text-neutral">
        Practical advice for couples who want to eat better, spend less, and stress less.
      </p>
    </section>

    <div class="mx-auto flex max-w-6xl flex-wrap justify-center gap-2 px-4 pb-4 sm:px-6 lg:px-8">
      <button
        v-for="cat in categories"
        :key="cat"
        class="rounded-full px-4 py-2 text-sm font-medium"
        :class="activeCategory === cat ? 'bg-primary text-white' : 'bg-base-300 text-neutral hover:text-base-content'"
        @click="activeCategory = cat"
      >
        {{ cat }}
      </button>
    </div>

    <section class="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:px-8">
      <article class="grid overflow-hidden rounded-2xl bg-base-200 shadow-lg lg:grid-cols-2">
        <!-- ponytail: placeholder image block, swap for real asset -->
        <div class="flex h-56 items-center justify-center bg-base-300 text-sm text-neutral lg:h-full">
          📷 Featured article image
        </div>
        <div class="p-8">
          <span class="inline-block rounded-md bg-indigo-950 px-3 py-1 text-xs font-semibold text-indigo-300">⭐ Featured</span>
          <h2 class="mt-4 text-2xl font-bold text-white">7 Meal Planning Mistakes Couples Make (And How to Fix Them)</h2>
          <p class="mt-3 text-[15px] leading-relaxed text-neutral">
            Most couples start with good intentions — then Monday happens. Here are the seven traps people fall into, and exactly how to avoid them.
          </p>
          <p class="mt-6 text-sm text-neutral-content">Meal Planning · 5 min read</p>
          <a href="#" class="mt-4 inline-block rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90">
            Read article →
          </a>
        </div>
      </article>
    </section>

    <section class="mx-auto max-w-6xl px-4 pb-20 sm:px-6 lg:px-8">
      <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <BlogCard v-for="post in filteredPosts" :key="post.title" v-bind="post" />
      </div>
    </section>

    <section class="bg-base-300 px-4 py-16 sm:px-6 lg:px-8">
      <div class="mx-auto max-w-4xl overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-8 py-12 text-center">
        <h2 class="text-2xl font-bold text-white sm:text-3xl">Get new posts in your inbox</h2>
        <p class="mx-auto mt-3 max-w-md text-indigo-200">Meal planning tips, recipe ideas and updates — no spam, ever.</p>
        <form
          class="mx-auto mt-6 flex max-w-md flex-col gap-3 sm:flex-row"
          @submit.prevent="subscribed = true"
        >
          <input
            type="email"
            required
            placeholder="your@email.com"
            class="flex-1 rounded-lg border-0 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-indigo-200 focus:outline-none focus:ring-2 focus:ring-white"
          >
          <button type="submit" class="rounded-lg bg-success px-6 py-3 text-sm font-bold text-success-content hover:opacity-90">
            Subscribe →
          </button>
        </form>
        <p v-if="subscribed" class="mt-3 text-sm text-indigo-100">Thanks — you're on the list!</p>
      </div>
    </section>

    <CtaBand />
  </div>
</template>
