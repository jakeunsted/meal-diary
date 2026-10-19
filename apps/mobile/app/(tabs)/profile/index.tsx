import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TourTarget } from '@/components/onboarding/TourTarget';
import { AccountCard } from '@/components/profile/AccountCard';
import { FamilyDetailsCard } from '@/components/profile/FamilyDetailsCard';
import { FamilyMembersCard } from '@/components/profile/FamilyMembersCard';
import { FamilySettingsCard } from '@/components/profile/FamilySettingsCard';
import { InviteModal } from '@/components/profile/InviteModal';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { LegalLinks } from '@/components/legal/LegalLinks';
import { SubscriptionCard } from '@/components/subscription/SubscriptionCard';
import { Box } from '@/components/ui/box';
import { useProductTourVisible } from '@/lib/onboarding/productTour';
import {
  measureTourTarget,
  notifyTourTargetsChanged,
  registerProfileTourScrollHandler,
} from '@/lib/onboarding/tourTargets';
import {
  useCurrentUser,
  useEntitlements,
  useFamilyGroup,
  useFamilyMembers,
} from '@/lib/queries/profile';

function waitForFrames(count: number): Promise<void> {
  return new Promise((resolve) => {
    let remaining = count;
    const tick = () => {
      remaining -= 1;
      if (remaining <= 0) {
        resolve();
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

export default function ProfileScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [isInviteModalVisible, setIsInviteModalVisible] = useState(false);
  const tourVisible = useProductTourVisible();

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

  useEffect(() => {
    return registerProfileTourScrollHandler(async (request) => {
      if (request !== 'invite') {
        return;
      }

      const scrollView = scrollRef.current;
      if (!scrollView) {
        return;
      }

      // Jump, do not animate — animated scroll remeasures the hole every frame.
      scrollView.scrollTo({ y: 0, animated: false });
      await waitForFrames(2);

      const rect = await measureTourTarget('profile-add-family-member');
      if (!rect || !scrollRef.current) {
        notifyTourTargetsChanged({ immediate: true });
        return;
      }

      const calloutReserve = 200;
      const tabBarClearance = 56 + Math.max(insets.bottom, 8);
      const maxBottom = windowHeight - tabBarClearance - calloutReserve;
      const targetBottom = rect.y + rect.height;
      if (targetBottom > maxBottom) {
        scrollRef.current.scrollTo({
          y: targetBottom - maxBottom,
          animated: false,
        });
        await waitForFrames(2);
      }

      notifyTourTargetsChanged({ immediate: true });
    });
  }, [insets.bottom, windowHeight]);

  return (
    <Box className="flex-1 bg-base">
      <ScrollView
        ref={scrollRef}
        contentContainerClassName="pb-8"
        contentContainerStyle={{ paddingTop: insets.top + 24 }}
        scrollEnabled={!tourVisible}
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

        <TourTarget id="profile-invite">
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
        </TourTarget>

        <FamilySettingsCard
          familyGroup={familyGroupQuery.data}
          members={membersQuery.data ?? []}
          currentUserId={userQuery.data?.id}
        />

        <SubscriptionCard entitlements={entitlements} />

        <AccountCard />

        <LegalLinks className="my-8" />
      </ScrollView>

      <InviteModal
        visible={isInviteModalVisible}
        familyGroupCode={familyGroupQuery.data?.random_identifier ?? ''}
        onClose={() => setIsInviteModalVisible(false)}
      />
    </Box>
  );
}
