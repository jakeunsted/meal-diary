import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, TextInput } from 'react-native';

import { MemberAvatar } from '@/components/profile/MemberAvatar';
import { Box } from '@/components/ui/box';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { ScreenTitle } from '@/components/ui/ScreenTitle';
import { Text } from '@/components/ui/text';
import { ApiError } from '@/lib/api/client';
import { confirmEmailChange, requestEmailChange, updateUserProfile } from '@/lib/queries/family';
import type { User } from '@/types/api';

interface ProfileHeaderProps {
  user: User | null | undefined;
  isLoading: boolean;
  error: string | null;
}

function getDisplayLabel(user: User): string {
  return `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || user.username;
}

export function ProfileHeader({ user, isLoading, error }: ProfileHeaderProps) {
  const { t } = useTranslation();
  const [displayName, setDisplayName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [emailDraft, setEmailDraft] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [emailCodeSent, setEmailCodeSent] = useState(false);
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null);

  useEffect(() => {
    setDisplayName(user?.username ?? '');
    setSaveError(null);
    setSaveSuccess(null);
  }, [user?.username]);

  useEffect(() => {
    setEmailDraft(user?.email ?? '');
    setEmailCode('');
    setEmailCodeSent(false);
  }, [user?.email]);

  if (isLoading) {
    return (
      <Box className="mb-8 items-center py-8">
        <ActivityIndicator size="large" color="#6366F1" />
      </Box>
    );
  }

  if (error) {
    return (
      <Box className="mb-8 rounded-lg bg-red-500/15 px-4 py-3">
        <Text className="text-red-400">{error}</Text>
      </Box>
    );
  }

  if (!user) return null;

  const trimmed = displayName.trim();
  const canSave = trimmed.length > 0 && trimmed !== user.username && !isSaving;
  const trimmedEmail = emailDraft.trim().toLowerCase();
  const canSendEmailCode =
    !isSavingEmail &&
    !emailCodeSent &&
    trimmedEmail.length > 0 &&
    trimmedEmail !== user.email.toLowerCase();
  const canConfirmEmail = !isSavingEmail && emailCodeSent && emailCode.trim().length === 6;

  const handleRequestEmailChange = async () => {
    if (!canSendEmailCode) return;
    setIsSavingEmail(true);
    setEmailError(null);
    setEmailSuccess(null);
    try {
      await requestEmailChange(trimmedEmail);
      setEmailCodeSent(true);
      setEmailSuccess(t('profile.emailCodeSent'));
    } catch (err) {
      setEmailError(err instanceof ApiError ? err.message : t('profile.emailUpdateFailed'));
    } finally {
      setIsSavingEmail(false);
    }
  };

  const handleConfirmEmailChange = async () => {
    if (!canConfirmEmail) return;
    setIsSavingEmail(true);
    setEmailError(null);
    setEmailSuccess(null);
    try {
      await confirmEmailChange(emailCode.trim());
      setEmailSuccess(t('profile.emailUpdated'));
    } catch (err) {
      setEmailError(err instanceof ApiError ? err.message : t('profile.emailUpdateFailed'));
    } finally {
      setIsSavingEmail(false);
    }
  };

  const handleSaveDisplayName = async () => {
    if (!canSave) return;
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(null);
    try {
      await updateUserProfile(user.id, { username: trimmed });
      setSaveSuccess(t('profile.displayNameUpdated'));
    } catch (err) {
      setSaveError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : t('profile.displayNameUpdateFailed')
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Box className="mb-8 items-center px-4">
      <Box className="mb-4">
        <MemberAvatar avatarUrl={user.avatar_url} size={128} />
      </Box>
      <ScreenTitle className="mb-4">{getDisplayLabel(user)}</ScreenTitle>

      <Box className="w-full gap-3 rounded-xl bg-surface p-4">
        <Box>
          <Text className="text-ice/80 mb-2 text-sm">{t('profile.displayName')}</Text>
          <TextInput
            className="rounded-lg bg-base px-4 py-3 text-ice"
            value={displayName}
            onChangeText={setDisplayName}
            editable={!isSaving}
            autoCapitalize="none"
            testID="profile-display-name-input"
          />
        </Box>
        <Box>
          <Text className="text-ice/80 mb-2 text-sm">{t('profile.email')}</Text>
          <TextInput
            className="rounded-lg bg-base px-4 py-3 text-ice"
            value={emailDraft}
            onChangeText={setEmailDraft}
            editable={!isSavingEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            testID="profile-email-input"
          />
        </Box>
        {emailCodeSent ? (
          <Box>
            <Text className="text-ice/80 mb-2 text-sm">{t('profile.confirmationCode')}</Text>
            <TextInput
              className="rounded-lg bg-base px-4 py-3 text-ice"
              value={emailCode}
              onChangeText={setEmailCode}
              editable={!isSavingEmail}
              keyboardType="number-pad"
              testID="profile-email-code-input"
            />
          </Box>
        ) : null}
        {emailError ? (
          <Text className="text-red-400 text-sm" testID="profile-email-error">
            {emailError}
          </Text>
        ) : null}
        {emailSuccess ? (
          <Text className="text-green-400 text-sm" testID="profile-email-success">
            {emailSuccess}
          </Text>
        ) : null}
        <Button
          variant="outline"
          disabled={emailCodeSent ? !canConfirmEmail : !canSendEmailCode}
          onPress={emailCodeSent ? handleConfirmEmailChange : handleRequestEmailChange}
          testID={emailCodeSent ? 'profile-email-confirm' : 'profile-email-send-code'}
        >
          {isSavingEmail ? <ButtonSpinner color="#F1F5F9" /> : null}
          <ButtonText>
            {emailCodeSent ? t('profile.confirmEmail') : t('profile.sendConfirmationCode')}
          </ButtonText>
        </Button>
        {saveError ? (
          <Text className="text-red-400 text-sm" testID="profile-display-name-error">
            {saveError}
          </Text>
        ) : null}
        {saveSuccess ? (
          <Text className="text-green-400 text-sm" testID="profile-display-name-success">
            {saveSuccess}
          </Text>
        ) : null}
        <Button
          disabled={!canSave}
          onPress={handleSaveDisplayName}
          testID="profile-save-display-name"
        >
          {isSaving && <ButtonSpinner color="#F1F5F9" />}
          <ButtonText>{t('profile.saveDisplayName')}</ButtonText>
        </Button>
      </Box>
    </Box>
  );
}
