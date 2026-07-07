import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AccountCard } from '@/components/profile/AccountCard';
import { FamilyDetailsCard } from '@/components/profile/FamilyDetailsCard';
import { FamilyMembersCard } from '@/components/profile/FamilyMembersCard';
import { FamilySettingsCard } from '@/components/profile/FamilySettingsCard';
import { InviteModal } from '@/components/profile/InviteModal';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { LegalLinks } from '@/components/legal/LegalLinks';
import { Box } from '@/components/ui/box';
import {
  useCurrentUser,
  useEntitlements,
  useFamilyGroup,
  useFamilyMembers,
} from '@/lib/queries/profile';

export default function ProfileScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [isInviteModalVisible, setIsInviteModalVisible] = useState(false);

  const userQuery = useCurrentUser();
  const familyGroupId = userQuery.data?.family_group_id;
  const familyGroupQuery = useFamilyGroup(familyGroupId);
  const membersQuery = useFamilyMembers(familyGroupId);
  const entitlementsQuery = useEntitlements(familyGroupId);

  const entitlements = entitlementsQuery.data;
  const showUpgradeLink = entitlements?.billing.isOwner ?? false;

  const canAddFamilyMember = entitlements ? entitlements.features.family_members : true;

  const memberLimitMessage = (() => {
    if (!entitlements || canAddFamilyMember) return '';
    if (entitlements.billing.isOwner) {
      return t('profile.familyMemberLimitOwner', {
        max: entitlements.limits.maxFamilyMembers,
      });
    }
    if (entitlements.billing.ownerDisplayName) {
      return t('profile.familyMemberLimitNonOwner', {
        name: entitlements.billing.ownerDisplayName,
      });
    }
    return t('profile.familyMemberLimitNonOwnerGeneric');
  })();

  const isRefreshing =
    userQuery.isRefetching || familyGroupQuery.isRefetching || membersQuery.isRefetching;

  const handleRefresh = () => {
    void userQuery.refetch();
    void familyGroupQuery.refetch();
    void membersQuery.refetch();
    void entitlementsQuery.refetch();
  };

  const handleAddFamilyMember = () => {
    if (!canAddFamilyMember) return;
    setIsInviteModalVisible(true);
  };

  return (
    <Box className="flex-1 bg-base">
      <ScrollView
        contentContainerClassName="px-4 pb-8"
        contentContainerStyle={{ paddingTop: insets.top + 24 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#6366F1"
          />
        }
      >
        <ProfileHeader
          user={userQuery.data}
          isLoading={userQuery.isLoading}
          error={userQuery.error ? userQuery.error.message : null}
        />

        <FamilyDetailsCard
          familyGroup={familyGroupQuery.data}
          isLoading={!!familyGroupId && familyGroupQuery.isLoading}
          error={familyGroupQuery.error ? familyGroupQuery.error.message : null}
          canAddFamilyMember={canAddFamilyMember}
          memberLimitMessage={memberLimitMessage}
          showUpgradeLink={showUpgradeLink}
        />

        <FamilyMembersCard
          members={membersQuery.data ?? []}
          isLoading={!!familyGroupId && membersQuery.isLoading}
          error={membersQuery.error ? membersQuery.error.message : null}
          ownerId={familyGroupQuery.data?.created_by}
          canAddFamilyMember={canAddFamilyMember}
          memberLimitMessage={memberLimitMessage}
          showUpgradeLink={showUpgradeLink}
          onAddFamilyMember={handleAddFamilyMember}
        />

        <FamilySettingsCard
          familyGroup={familyGroupQuery.data}
          members={membersQuery.data ?? []}
          currentUserId={userQuery.data?.id}
        />

        <AccountCard />

        <LegalLinks className="mt-8" />
      </ScrollView>

      <InviteModal
        visible={isInviteModalVisible}
        familyGroupCode={familyGroupQuery.data?.random_identifier ?? ''}
        onClose={() => setIsInviteModalVisible(false)}
      />
    </Box>
  );
}
