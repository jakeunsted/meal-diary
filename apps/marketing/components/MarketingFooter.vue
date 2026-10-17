<script setup lang="ts">
const { t } = useI18n();
const { webAppUrl, privacyUrl, termsUrl } = useAppLinks();
const { trackNavClick, trackWebAppCta } = useMarketingAnalytics();
const { $openCookiePreferences } = useNuxtApp();

const year = new Date().getFullYear();

const handleNavClick = (key: string) => {
  trackNavClick(key);
};

const handleOpenApp = () => {
  trackWebAppCta('footer');
};

const handleCookiePreferences = () => {
  try {
    ($openCookiePreferences as (() => void) | undefined)?.();
  } catch {
    /* ignore */
  }
};
</script>

<template>
  <footer class="mt-auto border-t border-white/10 bg-ink-900 text-ink-200">
    <div class="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-4 lg:px-8">
      <div class="md:col-span-1">
        <p class="flex items-center gap-2.5 font-display text-2xl font-semibold text-white">
          <img
            src="/logo.png"
            alt=""
            width="36"
            height="36"
            class="size-9 rounded-xl"
            decoding="async"
          >
          <span>{{ t('brand.name') }}</span>
        </p>
        <p class="mt-3 max-w-xs text-sm leading-relaxed text-ink-300">
          {{ t('footer.tagline') }}
        </p>
        <UButton
          :to="webAppUrl('footer')"
          color="primary"
          class="mt-5"
          @click="handleOpenApp"
        >
          {{ t('cta.openWebApp') }}
        </UButton>
      </div>

      <div>
        <p class="text-xs font-semibold uppercase tracking-wider text-ink-400">
          {{ t('footer.product') }}
        </p>
        <ul class="mt-3 space-y-2 text-sm">
          <li>
            <NuxtLink to="/features" class="hover:text-white" @click="handleNavClick('footer_features')">
              {{ t('nav.features') }}
            </NuxtLink>
          </li>
          <li>
            <NuxtLink to="/pricing" class="hover:text-white" @click="handleNavClick('footer_pricing')">
              {{ t('nav.pricing') }}
            </NuxtLink>
          </li>
          <li>
            <NuxtLink to="/about" class="hover:text-white" @click="handleNavClick('footer_about')">
              {{ t('nav.about') }}
            </NuxtLink>
          </li>
        </ul>
      </div>

      <div>
        <p class="text-xs font-semibold uppercase tracking-wider text-ink-400">
          {{ t('footer.company') }}
        </p>
        <ul class="mt-3 space-y-2 text-sm">
          <li>
            <NuxtLink to="/about" class="hover:text-white" @click="handleNavClick('footer_about_company')">
              {{ t('nav.about') }}
            </NuxtLink>
          </li>
        </ul>
      </div>

      <div>
        <p class="text-xs font-semibold uppercase tracking-wider text-ink-400">
          {{ t('footer.legal') }}
        </p>
        <ul class="mt-3 space-y-2 text-sm">
          <li>
            <a :href="privacyUrl" class="hover:text-white" target="_blank" rel="noopener" @click="handleNavClick('footer_privacy')">
              {{ t('footer.privacy') }}
            </a>
          </li>
          <li>
            <a :href="termsUrl" class="hover:text-white" target="_blank" rel="noopener" @click="handleNavClick('footer_terms')">
              {{ t('footer.terms') }}
            </a>
          </li>
          <li>
            <button
              type="button"
              class="hover:text-white"
              @click="handleCookiePreferences"
            >
              {{ t('footer.cookiePreferences') }}
            </button>
          </li>
        </ul>
      </div>
    </div>

    <div class="border-t border-white/10 px-4 py-4 text-center text-xs text-ink-400 sm:px-6">
      {{ t('footer.copyright', { year }) }}
    </div>
  </footer>
</template>
