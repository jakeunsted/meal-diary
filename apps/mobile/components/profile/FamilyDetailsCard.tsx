import FontAwesome from '@expo/vector-icons/FontAwesome';
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable } from 'react-native';

import { ProfileCard } from '@/components/profile/ProfileCard';
import { WarningAlert } from '@/components/profile/WarningAlert';
import { Box } from '@/components/ui/box';
import { Text } from '@/components/ui/text';
import type { FamilyGroup } from '@/types/api';

interface FamilyDetailsCardProps {
  familyGroup: FamilyGroup | null | undefined;
  isLoading: boolean;
  error: string | null;
  canAddFamilyMember: boolean;
  memberLimitMessage: string;
  showUpgradeLink?: boolean;
}

function SkeletonLines() {
  return (
    <Box className="items-center gap-4 py-2">
      <Box className="h-4 w-32 animate-pulse rounded bg-white/10" />
      <Box className="h-4 w-48 animate-pulse rounded bg-white/10" />
      <Box className="h-4 w-40 animate-pulse rounded bg-white/10" />
    </Box>
  );
}

export function FamilyDetailsCard({
  familyGroup,
  isLoading,
  error,
  canAddFamilyMember,
  memberLimitMessage,
  showUpgradeLink = false,
}: FamilyDetailsCardProps) {
  const { t } = useTranslation();
  const [hasCopied, setHasCopied] = useState(false);

  const handleCopyCode = async () => {
    if (!familyGroup?.random_identifier) return;
    await Clipboard.setStringAsync(familyGroup.random_identifier);
    setHasCopied(true);
    setTimeout(() => setHasCopied(false), 2000);
  };

  return (
    <ProfileCard title={t('profile.familyDetailsTitle')} className="mb-6">
      {isLoading ? (
        <SkeletonLines />
      ) : error ? (
        <Box className="rounded-lg bg-red-500/15 px-4 py-3">
          <Text className="text-red-400">{error}</Text>
        </Box>
      ) : familyGroup ? (
        <Box className="items-center gap-5">
          <Box className="items-center gap-1">
            <Text className="text-ice font-semibold text-base">
              {t('profile.familyGroupName')}
            </Text>
            <Text className="text-ice/80">{familyGroup.name}</Text>
          </Box>

          {canAddFamilyMember ? (
            <Box className="items-center gap-2">
              <Text className="text-ice font-semibold text-base">
                {t('profile.familyGroupCode')}
              </Text>
              <Pressable
                onPress={handleCopyCode}
                className="flex-row items-center gap-2 rounded-lg bg-base px-4 py-2"
                testID="profile-family-code"
              >
                <Text className="text-ice font-mono">{familyGroup.random_identifier}</Text>
                <FontAwesome
                  name={hasCopied ? 'check' : 'copy'}
                  size={14}
                  color={hasCopied ? '#2ECCA6' : 'rgba(241, 245, 249, 0.7)'}
                />
              </Pressable>
              <Text className="text-ice/60 mt-2 text-center text-sm">
                {hasCopied ? t('profile.codeCopied') : t('profile.shareCodeHint')}
              </Text>
            </Box>
          ) : memberLimitMessage ? (
            <WarningAlert
              message={memberLimitMessage}
              showUpgradeLink={showUpgradeLink}
              testID="profile-family-code-limit-message"
            />
          ) : null}
        </Box>
      ) : null}
    </ProfileCard>
  );
}
