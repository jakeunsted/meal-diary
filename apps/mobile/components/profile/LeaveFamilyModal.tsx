import type { ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, TextInput } from 'react-native';

import { DialogModal, DialogPanel } from '@/components/ui/DialogModal';
import { Box } from '@/components/ui/box';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { ApiError } from '@/lib/api/client';
import { useAuthStore } from '@/lib/auth/authStore';
import {
  clearFamilyQueries,
  deleteFamilyGroup,
  leaveFamilyGroup,
  refreshUserAfterFamilyChange,
  transferFamilyOwnership,
} from '@/lib/queries/family';
import type { DisplayMember, FamilyGroup } from '@/types/api';

type LeaveStep = 'leave' | 'owner-choice' | 'transfer' | 'delete' | 'transferred';

interface LeaveFamilyModalProps {
  visible: boolean;
  familyGroup: FamilyGroup;
  members: DisplayMember[];
  currentUserId: number;
  onClose: () => void;
}

export function LeaveFamilyModal({
  visible,
  familyGroup,
  members,
  currentUserId,
  onClose,
}: LeaveFamilyModalProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);

  const [step, setStep] = useState<LeaveStep>('leave');
  const [newOwnerId, setNewOwnerId] = useState<number | null>(null);
  const [deleteNameInput, setDeleteNameInput] = useState('');
  const [error, setError] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  const isOwner = familyGroup.created_by === currentUserId;
  const otherMembers = useMemo(
    () => members.filter((member) => member.id !== currentUserId),
    [members, currentUserId]
  );

  useEffect(() => {
    if (!visible) return;
    setStep(isOwner ? 'owner-choice' : 'leave');
    setNewOwnerId(null);
    setDeleteNameInput('');
    setError('');
  }, [visible, isOwner]);

  const handleClose = () => {
    if (isBusy) return;
    onClose();
  };

  const exitFamilyLocally = async () => {
    await clearFamilyQueries();
    const user = useAuthStore.getState().user;
    if (user) {
      const refreshedUser = await refreshUserAfterFamilyChange(user.id);
      setUser(refreshedUser);
    }
    handleClose();
    router.replace('/(auth)/registration/step-2');
  };

  const handleLeave = async () => {
    setError('');
    setIsBusy(true);
    try {
      await leaveFamilyGroup(familyGroup.id);
      await exitFamilyLocally();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t('familySettings.errors.leaveFailed')
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleTransfer = async () => {
    if (!newOwnerId) return;
    setError('');
    setIsBusy(true);
    try {
      await transferFamilyOwnership(familyGroup.id, newOwnerId);
      await clearFamilyQueries();
      setStep('transferred');
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t('familySettings.errors.transferFailed')
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleDelete = async () => {
    setError('');
    setIsBusy(true);
    try {
      await deleteFamilyGroup(familyGroup.id);
      await exitFamilyLocally();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t('familySettings.errors.deleteFailed')
      );
    } finally {
      setIsBusy(false);
    }
  };

  const renderActions = (children: ReactNode) => (
    <Box className="mt-6 flex-row flex-wrap justify-end gap-2">{children}</Box>
  );

  return (
    <DialogModal visible={visible} onClose={handleClose}>
      <DialogPanel className="max-h-[85%] w-full rounded-2xl bg-surface p-6">
          <ScrollView keyboardShouldPersistTaps="handled">
            {step === 'leave' ? (
              <>
                <Heading size="lg" className="text-ice mb-3">
                  {t('familySettings.leaveFamily')}
                </Heading>
                <Text className="text-ice/70">{t('familySettings.leaveConfirmMessage')}</Text>
                {error ? (
                  <Box className="mt-4 rounded-lg bg-red-500/15 px-4 py-3">
                    <Text className="text-red-400">{error}</Text>
                  </Box>
                ) : null}
                {renderActions(
                  <>
                    <Button variant="outline" disabled={isBusy} onPress={handleClose}>
                      <ButtonText>{t('common.cancel')}</ButtonText>
                    </Button>
                    <Button disabled={isBusy} onPress={handleLeave} testID="confirm-leave-button">
                      {isBusy && <ButtonSpinner color="#F1F5F9" />}
                      <ButtonText>{t('familySettings.leaveFamily')}</ButtonText>
                    </Button>
                  </>
                )}
              </>
            ) : null}

            {step === 'owner-choice' ? (
              <>
                <Heading size="lg" className="text-ice mb-3">
                  {t('familySettings.ownerChoiceTitle')}
                </Heading>
                <Text className="text-ice/70 mb-4">{t('familySettings.ownerChoiceMessage')}</Text>
                <Box className="gap-2">
                  <Button
                    disabled={otherMembers.length === 0 || isBusy}
                    onPress={() => setStep('transfer')}
                    testID="choose-transfer-button"
                  >
                    <ButtonText>{t('familySettings.transferOwnership')}</ButtonText>
                  </Button>
                  {otherMembers.length === 0 ? (
                    <Text className="text-ice/60 text-center text-xs">
                      {t('familySettings.noMembersToTransfer')}
                    </Text>
                  ) : null}
                  <Button
                    variant="outline"
                    className="border-red-500/40"
                    disabled={isBusy}
                    onPress={() => setStep('delete')}
                    testID="choose-delete-button"
                  >
                    <ButtonText className="text-red-400">{t('familySettings.deleteFamily')}</ButtonText>
                  </Button>
                </Box>
                {renderActions(
                  <Button variant="outline" disabled={isBusy} onPress={handleClose}>
                    <ButtonText>{t('common.cancel')}</ButtonText>
                  </Button>
                )}
              </>
            ) : null}

            {step === 'transfer' ? (
              <>
                <Heading size="lg" className="text-ice mb-3">
                  {t('familySettings.transferOwnership')}
                </Heading>
                <Text className="text-ice/70 mb-4">{t('familySettings.transferMessage')}</Text>
                <Box className="gap-2">
                  {otherMembers.map((member) => (
                    <Pressable
                      key={member.id}
                      className={`rounded-lg border px-4 py-3 ${
                        newOwnerId === member.id ? 'border-primary bg-primary/20' : 'border-white/10 bg-base'
                      }`}
                      disabled={isBusy}
                      onPress={() => setNewOwnerId(member.id)}
                      testID={`new-owner-option-${member.id}`}
                    >
                      <Text className="text-ice">{member.name}</Text>
                    </Pressable>
                  ))}
                </Box>
                {error ? (
                  <Box className="mt-4 rounded-lg bg-red-500/15 px-4 py-3">
                    <Text className="text-red-400">{error}</Text>
                  </Box>
                ) : null}
                {renderActions(
                  <>
                    <Button variant="outline" disabled={isBusy} onPress={() => setStep('owner-choice')}>
                      <ButtonText>{t('common.back')}</ButtonText>
                    </Button>
                    <Button
                      disabled={!newOwnerId || isBusy}
                      onPress={handleTransfer}
                      testID="confirm-transfer-button"
                    >
                      {isBusy && <ButtonSpinner color="#F1F5F9" />}
                      <ButtonText>{t('familySettings.transferOwnership')}</ButtonText>
                    </Button>
                  </>
                )}
              </>
            ) : null}

            {step === 'delete' ? (
              <>
                <Heading size="lg" className="text-red-400 mb-3">
                  {t('familySettings.deleteFamily')}
                </Heading>
                <Text className="text-ice/70 mb-4">{t('familySettings.deleteMessage')}</Text>
                <Text className="text-ice/80 mb-2 text-sm">
                  {t('familySettings.deleteConfirmLabel')}{' '}
                  <Text className="font-semibold text-ice">{familyGroup.name}</Text>
                </Text>
                <TextInput
                  className="rounded-lg bg-base px-4 py-3 text-ice"
                  placeholder={familyGroup.name}
                  placeholderTextColor="rgba(241, 245, 249, 0.4)"
                  value={deleteNameInput}
                  onChangeText={setDeleteNameInput}
                  editable={!isBusy}
                  testID="delete-family-name-input"
                />
                {error ? (
                  <Box className="mt-4 rounded-lg bg-red-500/15 px-4 py-3">
                    <Text className="text-red-400">{error}</Text>
                  </Box>
                ) : null}
                {renderActions(
                  <>
                    <Button
                      variant="outline"
                      disabled={isBusy}
                      onPress={() => setStep(isOwner ? 'owner-choice' : 'leave')}
                    >
                      <ButtonText>{t('common.back')}</ButtonText>
                    </Button>
                    <Button
                      disabled={deleteNameInput !== familyGroup.name || isBusy}
                      onPress={handleDelete}
                      testID="confirm-delete-family-button"
                    >
                      {isBusy && <ButtonSpinner color="#F1F5F9" />}
                      <ButtonText>{t('familySettings.deleteFamily')}</ButtonText>
                    </Button>
                  </>
                )}
              </>
            ) : null}

            {step === 'transferred' ? (
              <>
                <Heading size="lg" className="text-ice mb-3">
                  {t('familySettings.ownershipTransferredTitle')}
                </Heading>
                <Text className="text-ice/70">{t('familySettings.ownershipTransferredMessage')}</Text>
                {renderActions(
                  <>
                    <Button variant="outline" onPress={handleClose}>
                      <ButtonText>{t('common.close')}</ButtonText>
                    </Button>
                    <Button
                      onPress={() => setStep('leave')}
                      testID="leave-after-transfer-button"
                    >
                      <ButtonText>{t('familySettings.leaveFamily')}</ButtonText>
                    </Button>
                  </>
                )}
              </>
            ) : null}
          </ScrollView>
      </DialogPanel>
    </DialogModal>
  );
}
