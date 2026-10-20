<template>
  <div class="absolute inset-0 flex items-center justify-center bg-base-100 p-4">
    <div class="card w-full max-w-md bg-base-200 shadow-xl">
      <div class="card-body">
        <h1 class="card-title">{{ $t('alexa.link.title') }}</h1>

        <div v-if="!alexaConnectionEnabled" class="alert" data-testid="alexa-link-unavailable">
          <span>{{ $t('alexa.link.unavailable') }}</span>
        </div>

        <div v-else-if="!oauthRequestValid" class="alert alert-warning" data-testid="alexa-invalid-request">
          <span>{{ $t('alexa.link.invalidRequest') }}</span>
        </div>

        <template v-else-if="!isAuthenticated">
          <button
            v-if="isAppleConfigured"
            type="button"
            class="btn w-full bg-black text-white border-black hover:bg-neutral-800"
            data-testid="alexa-apple-button"
            :disabled="isSigningIn"
            @click="handleAppleSignIn"
          >
            {{ $t('Sign in with Apple') }}
          </button>
          <button
            type="button"
            class="btn btn-outline w-full"
            data-testid="alexa-google-button"
            :disabled="isSigningIn"
            @click="handleGoogleSignIn"
          >
            {{ $t('Sign in with Google') }}
          </button>

          <div class="divider">{{ $t('OR') }}</div>

          <form class="space-y-4" data-testid="alexa-link-sign-in-form" @submit.prevent="handleSignIn">
            <div class="form-control">
              <label class="label">
                <span class="label-text">{{ $t('alexa.link.email') }}</span>
              </label>
              <input
                v-model="email"
                type="email"
                autocomplete="email"
                class="input input-bordered"
                data-testid="alexa-link-email"
                :disabled="isSigningIn"
                required
              />
            </div>
            <div class="form-control">
              <label class="label">
                <span class="label-text">{{ $t('alexa.link.password') }}</span>
              </label>
              <input
                v-model="password"
                type="password"
                autocomplete="current-password"
                class="input input-bordered"
                data-testid="alexa-link-password"
                :disabled="isSigningIn"
                required
              />
            </div>
            <div v-if="signInError" class="alert alert-error" data-testid="alexa-link-sign-in-error">
              <span>{{ signInError }}</span>
            </div>
            <button
              type="submit"
              class="btn btn-primary w-full"
              data-testid="alexa-link-submit"
              :disabled="isSigningIn"
            >
              <span v-if="isSigningIn" class="loading loading-spinner"></span>
              <span v-else>{{ $t('alexa.link.signIn') }}</span>
            </button>
          </form>
        </template>

        <div v-else-if="!hasFamily || blockedState === 'family'" data-testid="alexa-family-required">
          <p>{{ $t('alexa.link.familyRequired') }}</p>
          <NuxtLink
            class="btn btn-primary mt-4"
            to="/registration/step-2"
            data-testid="alexa-family-link"
          >
            {{ $t('alexa.link.familyRequired') }}
          </NuxtLink>
        </div>

        <div v-else-if="linkContextLoading" class="flex justify-center py-6" data-testid="alexa-link-loading">
          <span class="loading loading-spinner loading-lg"></span>
        </div>

        <div v-else-if="linkContextError" class="alert alert-error" data-testid="alexa-link-error">
          <span>{{ $t('alexa.link.error') }}</span>
        </div>

        <div v-else-if="!hasAlexa || blockedState === 'premium'" data-testid="alexa-link-premium">
          <p>{{ $t('alexa.link.premiumDescription') }}</p>
          <NuxtLink
            v-if="isBillingOwner"
            class="btn btn-primary mt-4"
            to="/plans"
            data-testid="alexa-upgrade-link"
          >
            {{ $t('alexa.link.upgrade') }}
          </NuxtLink>
          <p v-else class="mt-4 text-sm" data-testid="alexa-ask-owner">
            {{ ownerName
              ? $t('alexa.link.askOwner', { name: ownerName })
              : $t('paywall.alexa.nonOwnerCtaGeneric') }}
          </p>
        </div>

        <div v-else data-testid="alexa-link-consent">
          <p>{{ $t('alexa.link.consent', { family: familyName }) }}</p>
          <div v-if="linkError" class="alert alert-error mt-4" data-testid="alexa-link-error">
            <span>{{ $t('alexa.link.error') }}</span>
          </div>
          <button
            type="button"
            class="btn btn-primary mt-4"
            data-testid="alexa-allow-button"
            :disabled="isAllowing"
            @click="handleAllow"
          >
            <span v-if="isAllowing" class="loading loading-spinner"></span>
            <span v-else>{{ $t('alexa.link.allow') }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { FEATURE_FLAGS } from '@meal-diary/shared';
import type { ResolvedEntitlements } from '~/types/Entitlements';
import { hasFamilyGroup } from '~/composables/useAuth';

definePageMeta({
  layout: false,
  middleware: ['auth'],
});

interface FamilyGroupResponse {
  data?: {
    name?: string;
  };
}

const route = useRoute();
const authStore = useAuthStore();
const { login, isLoading: isEmailLoginLoading, error: emailLoginError } = useAuth();
const { signInWithGoogle, isLoading: isGoogleLoginLoading, error: googleLoginError } = useGoogleAuth();
const {
  signInWithApple,
  isLoading: isAppleLoginLoading,
  error: appleLoginError,
  isConfigured: isAppleConfigured,
} = useAppleAuth();
const { api } = useApi();
const { enabled: alexaConnectionEnabled } = useFeatureFlag(FEATURE_FLAGS.alexaConnection);

const email = ref('');
const password = ref('');
const isAllowing = ref(false);
const linkError = ref(false);
const linkContextLoading = ref(false);
const linkContextError = ref(false);
const familyName = ref('');
const hasAlexa = ref(false);
const isBillingOwner = ref(false);
const ownerName = ref<string | null>(null);
const blockedState = ref<'premium' | 'family' | null>(null);

const isAuthenticated = computed(() => authStore.isAuthenticated);
const hasFamily = computed(() => hasFamilyGroup(authStore.user));
const isSigningIn = computed(() =>
  isEmailLoginLoading.value || isGoogleLoginLoading.value || isAppleLoginLoading.value
);
const signInError = computed(() =>
  emailLoginError.value || googleLoginError.value || appleLoginError.value
);

const queryValue = (key: string): string => {
  const value = route.query[key];
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0] : '';
  }
  return typeof value === 'string' ? value : '';
};

const oauthRequestValid = computed(() =>
  queryValue('response_type') === 'code'
  && queryValue('client_id').length > 0
  && queryValue('redirect_uri').length > 0
  && queryValue('state').length > 0
);

const readErrorCode = (error: unknown): string | undefined => {
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  const body = error as {
    code?: string;
    data?: { code?: string; data?: { code?: string } };
  };
  return body.data?.data?.code || body.data?.code || body.code;
};

const loadLinkContext = async () => {
  const familyGroupId = authStore.user?.family_group_id;
  if (!alexaConnectionEnabled.value || !familyGroupId || !oauthRequestValid.value) {
    return;
  }

  linkContextLoading.value = true;
  linkContextError.value = false;

  try {
    const [entitlements, familyResponse] = await Promise.all([
      api<ResolvedEntitlements>(`/api/family-groups/${familyGroupId}/entitlements`, {
        silent: true,
        suppressPaywall: true,
      }),
      api<FamilyGroupResponse>(`/api/family-groups/${familyGroupId}`, {
        silent: true,
        suppressPaywall: true,
      }),
    ]);

    useSubscriptionStore().setEntitlements(entitlements);
    hasAlexa.value = entitlements.features.alexa === true;
    isBillingOwner.value = entitlements.billing?.isOwner === true;
    ownerName.value = entitlements.billing?.ownerDisplayName ?? null;
    familyName.value = familyResponse.data?.name || '';
  } catch {
    linkContextError.value = true;
  } finally {
    linkContextLoading.value = false;
  }
};

watch(
  () => [
    alexaConnectionEnabled.value,
    isAuthenticated.value,
    authStore.user?.family_group_id,
    oauthRequestValid.value,
  ] as const,
  ([enabled, signedIn, familyGroupId, requestValid]) => {
    if (enabled && signedIn && familyGroupId && requestValid) {
      loadLinkContext();
    }
  },
  { immediate: true },
);

const handleSignIn = async () => {
  try {
    await login(email.value, password.value);
  } catch (err) {
    console.error('Alexa link sign-in error:', err);
  }
};

const handleGoogleSignIn = async () => {
  try {
    await signInWithGoogle({ returnPath: route.fullPath });
  } catch (err) {
    console.error('Alexa link Google sign-in error:', err);
  }
};

const handleAppleSignIn = async () => {
  try {
    const result = await signInWithApple({ returnPath: route.fullPath });
    if (result === 'cancelled') {
      return;
    }
  } catch (err) {
    console.error('Alexa link Apple sign-in error:', err);
  }
};

const handleAllow = async () => {
  if (
    !alexaConnectionEnabled.value
    || !oauthRequestValid.value
    || !hasFamily.value
    || !hasAlexa.value
    || blockedState.value
  ) {
    return;
  }

  isAllowing.value = true;
  linkError.value = false;

  try {
    const scope = queryValue('scope');
    const body: Record<string, string> = {
      clientId: queryValue('client_id'),
      redirectUri: queryValue('redirect_uri'),
      state: queryValue('state'),
      responseType: queryValue('response_type'),
    };
    if (scope) {
      body.scope = scope;
    }

    const result = await api<{ redirectUrl?: string }>('/api/alexa/oauth/authorize', {
      method: 'POST',
      body,
      silent: true,
      suppressPaywall: true,
    });

    if (result?.redirectUrl) {
      window.location.href = result.redirectUrl;
      return;
    }

    linkError.value = true;
  } catch (error) {
    const code = readErrorCode(error);
    if (code === 'ENTITLEMENT_REQUIRED') {
      blockedState.value = 'premium';
      hasAlexa.value = false;
    } else if (code === 'FAMILY_REQUIRED') {
      blockedState.value = 'family';
    } else {
      linkError.value = true;
    }
  } finally {
    isAllowing.value = false;
  }
};
</script>
