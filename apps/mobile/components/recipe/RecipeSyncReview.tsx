import { useQueryClient } from '@tanstack/react-query';
import { usePathname } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';

import { DialogModal, DialogPanel } from '@/components/ui/DialogModal';
import { Box } from '@/components/ui/box';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { recipeSyncChangeLabel } from '@meal-diary/shared';
import { useAuthStore } from '@/lib/auth/authStore';
import {
  flushRecipePending,
  keepAllRecipesMine,
  keepAllRecipesTheirs,
  keepRecipeMine,
  keepRecipeTheirs,
  type RecipeSyncConflict,
} from '@/lib/recipe/recipeSync';
import { useRecipeConflicts, useRecipeSyncStatus } from '@/lib/recipe/useRecipeSync';

function isRecipeRoute(pathname: string): boolean {
  return pathname.includes('/recipes') || pathname.includes('/recipe/');
}

export function RecipeSyncStatusBanner() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const familyGroupId = useAuthStore((state) => state.user?.family_group_id);
  const status = useRecipeSyncStatus(familyGroupId ?? undefined);

  if (status.pendingCount === 0 && !status.syncError) {
    return null;
  }

  return (
    <Box className="mb-4 gap-2">
      {status.pendingCount > 0 ? (
        <Box className="rounded-lg bg-primary/15 px-4 py-3" testID="recipe-sync-pending">
          <Text className="text-sm text-ice">{t('recipeSync.pending')}</Text>
        </Box>
      ) : null}
      {status.syncError ? (
        <Box className="rounded-lg bg-red-500/15 px-4 py-3" testID="recipe-sync-failed">
          <Text className="mb-2 text-sm text-red-400">{t('recipeSync.syncFailed')}</Text>
          <Button
            size="sm"
            variant="outline"
            testID="recipe-sync-retry"
            onPress={() => {
              if (familyGroupId) {
                void flushRecipePending(queryClient, familyGroupId);
              }
            }}
          >
            <ButtonText>{t('recipeSync.retry')}</ButtonText>
          </Button>
        </Box>
      ) : null}
    </Box>
  );
}

export function RecipeSyncReviewHost() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const familyGroupId = useAuthStore((state) => state.user?.family_group_id) ?? undefined;
  const conflicts = useRecipeConflicts(familyGroupId);
  const status = useRecipeSyncStatus(familyGroupId);
  const visible = isRecipeRoute(pathname) && conflicts.length > 0;

  const handleKeepMine = (conflict: RecipeSyncConflict) => {
    if (familyGroupId) {
      void keepRecipeMine(queryClient, familyGroupId, conflict);
    }
  };
  const handleKeepTheirs = (conflict: RecipeSyncConflict) => {
    if (familyGroupId) {
      void keepRecipeTheirs(queryClient, familyGroupId, conflict);
    }
  };

  return (
    <DialogModal
      visible={visible}
      onClose={() => {
        if (familyGroupId) {
          void keepAllRecipesTheirs(queryClient, familyGroupId);
        }
      }}
      testID="recipe-sync-review-modal"
    >
      <DialogPanel className="max-h-[85%] w-full">
        <Heading size="lg" className="text-ice mb-2">
          {t('recipeSync.title')}
        </Heading>
        <Text className="text-ice/70 mb-4 text-sm">{t('recipeSync.body')}</Text>
        <ScrollView style={{ flexGrow: 0, flexShrink: 1 }} keyboardShouldPersistTaps="handled">
          {conflicts.map((conflict) => (
            <Box
              key={conflict.recipeId}
              className="mb-3 rounded-xl bg-base px-4 py-3"
              testID={`recipe-sync-row-${conflict.recipeId}`}
            >
              <Text className="text-ice text-sm">
                {t('recipeSync.yours')}: {recipeSyncChangeLabel(conflict.yours)}
              </Text>
              <Text className="text-ice/70 mb-2 text-sm">
                {t('recipeSync.theirs')}: {recipeSyncChangeLabel(conflict.theirs)}
              </Text>
              <Box className="flex-row flex-wrap gap-2">
                <Button
                  size="sm"
                  className="bg-primary"
                  testID="recipe-sync-keep-mine"
                  disabled={status.isFlushing}
                  onPress={() => handleKeepMine(conflict)}
                >
                  {status.isFlushing ? <ButtonSpinner /> : null}
                  <ButtonText>{t('recipeSync.keepMine')}</ButtonText>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  testID="recipe-sync-keep-theirs"
                  disabled={status.isFlushing}
                  onPress={() => handleKeepTheirs(conflict)}
                >
                  <ButtonText>{t('recipeSync.keepTheirs')}</ButtonText>
                </Button>
              </Box>
            </Box>
          ))}
        </ScrollView>
        {conflicts.length > 1 ? (
          <Box className="mt-2 flex-row flex-wrap gap-2">
            <Button
              size="sm"
              className="bg-primary"
              testID="recipe-sync-keep-all-mine"
              disabled={status.isFlushing}
              onPress={() => {
                if (familyGroupId) {
                  void keepAllRecipesMine(queryClient, familyGroupId);
                }
              }}
            >
              <ButtonText>{t('recipeSync.keepAllMine')}</ButtonText>
            </Button>
            <Button
              size="sm"
              variant="outline"
              testID="recipe-sync-keep-all-theirs"
              disabled={status.isFlushing}
              onPress={() => {
                if (familyGroupId) {
                  void keepAllRecipesTheirs(queryClient, familyGroupId);
                }
              }}
            >
              <ButtonText>{t('recipeSync.keepAllTheirs')}</ButtonText>
            </Button>
          </Box>
        ) : null}
      </DialogPanel>
    </DialogModal>
  );
}
