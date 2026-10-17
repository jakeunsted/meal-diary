<template>
  <div class="flex min-h-screen flex-col">
    <MarketingNav />
    <main class="flex-1">
      <slot />
    </main>
    <MarketingFooter />
  </div>
</template>
