import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, TextInput } from 'react-native';

import { Box } from '@/components/ui/box';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { ApiError } from '@/lib/api/client';
import { useAuthStore } from '@/lib/auth/authStore';
import { deleteAccount } from '@/lib/queries/account';
import type { User } from '@/types/api';

interface DeleteAccountModalProps {
  visible: boolean;
  user: User | null | undefined;
  onClose: () => void;
}

export function DeleteAccountModal({ visible, user, onClose }: DeleteAccountModalProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);

  const [confirmInput, setConfirmInput] = useState('');
  const [error, setError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const hasPassword = user?.has_password !== false;

  useEffect(() => {
    if (!visible) return;
    setConfirmInput('');
    setError('');
  }, [visible]);

  const canSubmit =
    !isDeleting &&
    (hasPassword ? confirmInput.length > 0 : confirmInput === 'DELETE');

  const handleClose = () => {
    if (isDeleting) return;
    onClose();
  };

  const handleDelete = async () => {
    if (!canSubmit) return;

    setError('');
    setIsDeleting(true);

    try {
      const body = hasPassword
        ? { password: confirmInput }
        : { confirmation: confirmInput };

      await deleteAccount(body);
      await logout();
      handleClose();
      router.replace('/(auth)/login');
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : t('profile.account.deleteFailed')
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable className="flex-1 items-center justify-center bg-black/60 px-6" onPress={handleClose}>
        <Pressable className="max-h-[85%] w-full rounded-2xl bg-surface p-6" onPress={() => {}}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Heading size="lg" className="text-red-400 mb-3">
              {t('profile.account.deleteAccount')}
            </Heading>

            <Text className="text-ice/70 mb-2">{t('profile.account.deleteListTitle')}</Text>
            <Box className="mb-4 gap-1">
              <Text className="text-ice/80 text-sm">• {t('profile.account.deleteItemAccount')}</Text>
              <Text className="text-ice/80 text-sm">• {t('profile.account.deleteItemRecipes')}</Text>
              <Text className="text-ice/80 text-sm">• {t('profile.account.deleteItemFamily')}</Text>
            </Box>

            <Text className="text-ice/80 mb-2 text-sm">
              {hasPassword
                ? t('profile.account.confirmPassword')
                : t('profile.account.confirmDelete')}
            </Text>
            <TextInput
              className="rounded-lg bg-base px-4 py-3 text-ice"
              placeholder={hasPassword ? undefined : 'DELETE'}
              placeholderTextColor="rgba(241, 245, 249, 0.4)"
              secureTextEntry={hasPassword}
              autoCapitalize="none"
              value={confirmInput}
              onChangeText={setConfirmInput}
              editable={!isDeleting}
              testID="delete-confirm-input"
            />

            {error ? (
              <Box className="mt-4 rounded-lg bg-red-500/15 px-4 py-3">
                <Text className="text-red-400" testID="delete-error">
                  {error}
                </Text>
              </Box>
            ) : null}

            <Box className="mt-6 flex-row justify-end gap-3">
              <Button variant="outline" disabled={isDeleting} onPress={handleClose}>
                <ButtonText>{t('common.cancel')}</ButtonText>
              </Button>
              <Button
                disabled={!canSubmit}
                onPress={handleDelete}
                testID="delete-confirm-button"
              >
                {isDeleting && <ButtonSpinner color="#F1F5F9" />}
                <ButtonText>{t('profile.account.deleteAccount')}</ButtonText>
              </Button>
            </Box>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
