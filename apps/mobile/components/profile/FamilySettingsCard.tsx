import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { LeaveFamilyModal } from '@/components/profile/LeaveFamilyModal';
import { ProfileCard } from '@/components/profile/ProfileCard';
import { Button, ButtonText } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import type { DisplayMember, FamilyGroup } from '@/types/api';

interface FamilySettingsCardProps {
  familyGroup: FamilyGroup | undefined;
  members: DisplayMember[];
  currentUserId: number | undefined;
}

export function FamilySettingsCard({
  familyGroup,
  members,
  currentUserId,
}: FamilySettingsCardProps) {
  const { t } = useTranslation();
  const [isModalVisible, setIsModalVisible] = useState(false);

  if (!familyGroup || !currentUserId) return null;

  const isOwner = familyGroup.created_by === currentUserId;

  return (
    <>
      <ProfileCard title={t('familySettings.title')} className="mt-4">
        <Text className="text-ice/70 mb-4 text-sm">
          {isOwner ? t('familySettings.ownerDescription') : t('familySettings.memberDescription')}
        </Text>
        <Button
          variant="outline"
          className="border-red-500/40"
          onPress={() => setIsModalVisible(true)}
          testID="leave-family-button"
        >
          <ButtonText className="text-red-400">{t('familySettings.leaveFamily')}</ButtonText>
        </Button>
      </ProfileCard>

      <LeaveFamilyModal
        visible={isModalVisible}
        familyGroup={familyGroup}
        members={members}
        currentUserId={currentUserId}
        onClose={() => setIsModalVisible(false)}
      />
    </>
  );
}
