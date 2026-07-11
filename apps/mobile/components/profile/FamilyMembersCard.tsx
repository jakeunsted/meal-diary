import { useTranslation } from 'react-i18next';

import { MemberAvatar } from '@/components/profile/MemberAvatar';
import { ProfileCard } from '@/components/profile/ProfileCard';
import { WarningAlert } from '@/components/profile/WarningAlert';
import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import type { DisplayMember } from '@/types/api';

interface FamilyMembersCardProps {
  members: DisplayMember[];
  isLoading: boolean;
  error: string | null;
  ownerId: number | null | undefined;
  canAddFamilyMember: boolean;
  memberLimitMessage: string;
  showUpgradeLink?: boolean;
  onAddFamilyMember: () => void;
}

function MemberSkeleton() {
  return (
    <Box className="flex-row flex-wrap gap-4">
      {[0, 1].map((index) => (
        <Box key={index} className="w-[47%] items-center rounded-xl bg-base p-4">
          <Box className="mb-3 h-16 w-16 animate-pulse rounded-full bg-white/10" />
          <Box className="h-4 w-20 animate-pulse rounded bg-white/10" />
        </Box>
      ))}
    </Box>
  );
}

export function FamilyMembersCard({
  members,
  isLoading,
  error,
  ownerId,
  canAddFamilyMember,
  memberLimitMessage,
  showUpgradeLink = false,
  onAddFamilyMember,
}: FamilyMembersCardProps) {
  const { t } = useTranslation();

  return (
    <ProfileCard title={t('profile.familyMembersTitle')} className="mb-6">
      {isLoading ? (
        <MemberSkeleton />
      ) : error ? (
        <Box className="rounded-lg bg-red-500/15 px-4 py-3">
          <Text className="text-red-400">{error}</Text>
        </Box>
      ) : (
        <Box>
          {members.length > 0 ? (
            <Box className="flex-row flex-wrap justify-between gap-y-4">
              {members.map((member) => (
                <Box
                  key={member.id}
                  className="w-[47%] items-center rounded-xl bg-base p-4"
                >
                  <Box className="mb-3">
                    <MemberAvatar avatarUrl={member.avatar_url} size={64} />
                  </Box>
                  <Text className="text-ice text-center font-semibold">{member.name}</Text>
                  {member.id === ownerId && (
                    <Box className="mt-1 rounded-full bg-primary px-2 py-0.5" testID="owner-badge">
                      <Text className="text-ice text-xs">{t('profile.owner')}</Text>
                    </Box>
                  )}
                </Box>
              ))}
            </Box>
          ) : (
            <Box className="items-center py-4">
              <Text className="text-ice font-semibold">{t('profile.noMembers')}</Text>
            </Box>
          )}

          {!canAddFamilyMember && memberLimitMessage ? (
            <WarningAlert
              message={memberLimitMessage}
              showUpgradeLink={showUpgradeLink}
              className="mt-4"
              testID="profile-family-member-limit-message"
            />
          ) : null}

          <Button
            size="lg"
            className="mt-5 self-center"
            disabled={!canAddFamilyMember}
            onPress={onAddFamilyMember}
            testID="profile-add-family-member-button"
          >
            <ButtonText>{t('profile.addFamilyMember')}</ButtonText>
          </Button>
        </Box>
      )}
    </ProfileCard>
  );
}
