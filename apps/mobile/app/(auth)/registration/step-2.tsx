import { Redirect, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, TextInput } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { Box } from '@/components/ui/box';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { colors } from '@/constants/theme';
import { ApiError } from '@/lib/api/client';
import { useAuthStore } from '@/lib/auth/authStore';
import { hasFamilyGroup } from '@/lib/auth/helpers';
import { getRegisterCode } from '@/lib/auth/registerStorage';
import {
  createFamilyGroup,
  joinFamilyGroup,
  refreshUserAfterFamilyChange,
} from '@/lib/queries/family';

type FamilyTab = 'create' | 'join';

function resolveJoinErrorMessage(error: unknown, t: (key: string) => string): string {
  if (error instanceof ApiError) {
    if (error.code === 'ENTITLEMENT_REQUIRED' && error.feature === 'family_members') {
      return t('registrationStep2.familyGroupFull');
    }
    if (error.status === 404) {
      return t('registrationStep2.familyNotFound');
    }
  }
  return t('registrationStep2.joinFailed');
}

export default function RegistrationStep2Screen() {
  const { t } = useTranslation();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const status = useAuthStore((state) => state.status);

  const [activeTab, setActiveTab] = useState<FamilyTab>('create');
  const [familyName, setFamilyName] = useState('');
  const [familyKey, setFamilyKey] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    void getRegisterCode().then((code) => {
      if (code) {
        setActiveTab('join');
        setFamilyKey(code);
      }
    });
  }, []);

  if (status === 'signedOut') {
    return <Redirect href="/(auth)/login" />;
  }

  if (hasFamilyGroup(user)) {
    return <Redirect href="/(tabs)/diary" />;
  }

  const handleSubmit = async () => {
    if (!user) return;

    setErrorMessage('');
    setIsLoading(true);

    try {
      if (activeTab === 'create') {
        await createFamilyGroup(familyName.trim());
      } else {
        await joinFamilyGroup(familyKey.trim());
      }

      await refreshUserAfterFamilyChange(user.id);
      router.replace('/(tabs)/diary');
    } catch (error) {
      if (activeTab === 'create') {
        setErrorMessage(t('registrationStep2.createFailed'));
      } else {
        setErrorMessage(resolveJoinErrorMessage(error, t));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const inputClassName = 'rounded-lg bg-surface px-4 py-3 text-ice';
  const tabClassName = (tab: FamilyTab) =>
    `flex-1 rounded-lg px-4 py-3 ${activeTab === tab ? 'bg-primary' : 'bg-surface'}`;

  return (
    <KeyboardAwareScrollView
      style={{ flex: 1, backgroundColor: colors.base }}
      contentContainerStyle={{
        flexGrow: 1,
        justifyContent: 'center',
        paddingHorizontal: 24,
        paddingVertical: 48,
      }}
      keyboardShouldPersistTaps="handled"
      bottomOffset={24}
    >
      <Heading size="2xl" className="text-ice mb-6 text-center">
          {t('registrationStep2.title')}
        </Heading>

        <Box className="mb-6 flex-row gap-2">
          <Pressable
            className={tabClassName('create')}
            onPress={() => setActiveTab('create')}
            disabled={isLoading}
            testID="family-tab-create"
          >
            <Text
              className={`text-center text-sm font-medium ${
                activeTab === 'create' ? 'text-ice' : 'text-ice/70'
              }`}
            >
              {t('registrationStep2.createNew')}
            </Text>
          </Pressable>
          <Pressable
            className={tabClassName('join')}
            onPress={() => setActiveTab('join')}
            disabled={isLoading}
            testID="family-tab-join"
          >
            <Text
              className={`text-center text-sm font-medium ${
                activeTab === 'join' ? 'text-ice' : 'text-ice/70'
              }`}
            >
              {t('registrationStep2.joinExisting')}
            </Text>
          </Pressable>
        </Box>

        <Box className="gap-4">
          {activeTab === 'create' ? (
            <Box>
              <Text className="text-ice/80 mb-2 text-sm">
                {t('registrationStep2.familyGroupName')}
              </Text>
              <TextInput
                className={inputClassName}
                placeholder={t('registrationStep2.familyGroupNamePlaceholder')}
                placeholderTextColor="rgba(241, 245, 249, 0.4)"
                value={familyName}
                onChangeText={setFamilyName}
                editable={!isLoading}
                testID="family-create-name-input"
              />
            </Box>
          ) : (
            <Box>
              <Text className="text-ice/80 mb-2 text-sm">
                {t('registrationStep2.familyGroupCode')}
              </Text>
              <TextInput
                className={inputClassName}
                placeholder={t('registrationStep2.familyGroupCodePlaceholder')}
                placeholderTextColor="rgba(241, 245, 249, 0.4)"
                autoCapitalize="none"
                value={familyKey}
                onChangeText={setFamilyKey}
                editable={!isLoading}
                testID="family-join-key-input"
              />
            </Box>
          )}

          <Button
            size="lg"
            disabled={
              isLoading ||
              (activeTab === 'create' ? familyName.trim().length === 0 : familyKey.trim().length === 0)
            }
            onPress={handleSubmit}
            testID="family-submit-button"
          >
            {isLoading && <ButtonSpinner color="#F1F5F9" />}
            <ButtonText>
              {activeTab === 'create'
                ? t('registrationStep2.createFamilyGroup')
                : t('registrationStep2.joinFamilyGroup')}
            </ButtonText>
          </Button>

          {errorMessage ? (
            <Text className="text-red-400 text-center" testID="family-error-message">
              {errorMessage}
            </Text>
          ) : null}
        </Box>
    </KeyboardAwareScrollView>
  );
}
