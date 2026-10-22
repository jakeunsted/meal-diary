import { type AlexaLinkStatus } from '@meal-diary/shared';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator } from 'react-native';

import { ProfileCard } from '@/components/profile/ProfileCard';
import { DialogModal, DialogPanel } from '@/components/ui/DialogModal';
import { Box } from '@/components/ui/box';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { apiFetch } from '@/lib/api/client';
import { alexaSettingsState } from '@/lib/alexa/alexaSettingsState';
import { usePaywallStore } from '@/lib/entitlements/paywallStore';
import { useEntitlements } from '@/lib/queries/profile';

interface AlexaIntegrationCardProps {
  familyGroupId: number;
}

export function AlexaIntegrationCard({ familyGroupId }: AlexaIntegrationCardProps) {
  const { t } = useTranslation();
  const openPaywall = usePaywallStore((state) => state.openPaywall);
  const entitlementsQuery = useEntitlements(familyGroupId);
  const [alexaStatus, setAlexaStatus] = useState<AlexaLinkStatus | null>(null);
  const [alexaLoadError, setAlexaLoadError] = useState(false);
  const [isDisconnectConfirmVisible, setIsDisconnectConfirmVisible] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [disconnectError, setDisconnectError] = useState(false);
  const alexaRequestId = useRef(0);

  const loadAlexaStatus = useCallback(async () => {
    const requestId = ++alexaRequestId.current;
    setAlexaLoadError(false);
    try {
      const next = await apiFetch<AlexaLinkStatus>('/alexa/link');
      if (alexaRequestId.current !== requestId) return;
      setAlexaStatus(next);
    } catch {
      if (alexaRequestId.current !== requestId) return;
      setAlexaStatus(null);
      setAlexaLoadError(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadAlexaStatus();
      return () => {
        alexaRequestId.current += 1;
      };
    }, [loadAlexaStatus])
  );

  const handleUpgrade = () => {
    openPaywall('alexa');
  };

  const handleDisconnect = () => {
    setDisconnectError(false);
    setIsDisconnectConfirmVisible(true);
  };

  const handleCloseDisconnect = () => {
    if (isDisconnecting) return;
    setIsDisconnectConfirmVisible(false);
  };

  const handleConfirmDisconnect = async () => {
    setIsDisconnecting(true);
    setDisconnectError(false);
    try {
      await apiFetch<void>('/alexa/link', { method: 'DELETE' });
    } catch {
      setDisconnectError(true);
      setIsDisconnectConfirmVisible(false);
      setIsDisconnecting(false);
      return;
    }
    setIsDisconnectConfirmVisible(false);
    setIsDisconnecting(false);
    setAlexaStatus(null);
    await loadAlexaStatus();
  };

  const billing = entitlementsQuery.data?.billing;
  const entitlementsPending = entitlementsQuery.data == null && !entitlementsQuery.isError;
  const hasAlexa = entitlementsQuery.data?.features.alexa === true;
  const alexaView =
    alexaStatus && !entitlementsPending
      ? alexaSettingsState(alexaStatus.connected, hasAlexa)
      : null;
  const statusLabel = !hasAlexa
    ? t('integrations.familyPlus')
    : alexaView === 'connected'
      ? t('familySettings.alexa.connected')
      : t('familySettings.alexa.notConnected');
  const upgradeLabel = billing?.isOwner
    ? t('paywall.alexa.ownerCta')
    : billing?.ownerDisplayName
      ? t('paywall.alexa.nonOwnerCta', { name: billing.ownerDisplayName })
      : t('paywall.alexa.nonOwnerCtaGeneric');

  return (
    <>
      <ProfileCard title={t('familySettings.alexa.title')} className="mb-6">
        <Box testID="alexa-settings" className="gap-4">
          <Box className="flex-row items-start justify-between gap-3">
            <Text className="text-ice/70 flex-1 text-sm">
              {t('familySettings.alexa.description')}
            </Text>
            {alexaView ? (
              <Text className="text-ice text-sm" testID="alexa-status-badge">
                {statusLabel}
              </Text>
            ) : null}
          </Box>

          {!alexaView ? (
            alexaLoadError && !entitlementsPending ? (
              <Box className="rounded-lg bg-red-500/15 px-4 py-3">
                <Text className="text-red-400 text-sm">{t('familySettings.alexa.statusError')}</Text>
              </Box>
            ) : (
              <Box className="flex-row items-center gap-3">
                <ActivityIndicator size="small" color="#6366F1" />
                <Text className="text-ice/70 text-sm">{t('familySettings.alexa.loading')}</Text>
              </Box>
            )
          ) : alexaView === 'premium' ? (
            <Box className="gap-4">
              <Text className="text-ice/70 text-sm">
                {t('familySettings.alexa.premiumDescription')}
              </Text>
              {billing?.isOwner ? (
                <Button onPress={handleUpgrade} testID="alexa-upgrade-button">
                  <ButtonText>{upgradeLabel}</ButtonText>
                </Button>
              ) : (
                <Text className="text-ice/70 text-sm" testID="alexa-non-owner">
                  {upgradeLabel}
                </Text>
              )}
            </Box>
          ) : alexaView === 'notConnected' ? (
            <Text className="text-ice/60 text-sm">{t('familySettings.alexa.notConnectedHint')}</Text>
          ) : (
            <Box className="gap-4">
              {!hasAlexa ? (
                <Text className="text-ice/70 text-sm">
                  {t('familySettings.alexa.premiumDescription')}
                </Text>
              ) : null}
              <Button
                variant="outline"
                className="border-red-500/40"
                onPress={handleDisconnect}
                disabled={isDisconnecting}
                testID="alexa-disconnect-button"
              >
                <ButtonText className="text-red-400">
                  {t('familySettings.alexa.disconnect')}
                </ButtonText>
              </Button>
              {disconnectError ? (
                <Text className="text-red-400 text-sm">
                  {t('familySettings.alexa.disconnectFailed')}
                </Text>
              ) : null}
            </Box>
          )}
        </Box>
      </ProfileCard>

      <DialogModal
        visible={isDisconnectConfirmVisible}
        onClose={handleCloseDisconnect}
        testID="alexa-disconnect-dialog"
      >
        <DialogPanel>
          <Heading size="lg" className="mb-3 text-red-400">
            {t('familySettings.alexa.disconnect')}
          </Heading>
          <Text className="mb-6 text-ice/80">{t('familySettings.alexa.disconnectConfirm')}</Text>
          <Box className="flex-row justify-end gap-3">
            <Button variant="outline" onPress={handleCloseDisconnect} disabled={isDisconnecting}>
              <ButtonText>{t('common.cancel')}</ButtonText>
            </Button>
            <Button
              className="bg-red-500"
              onPress={() => {
                void handleConfirmDisconnect();
              }}
              disabled={isDisconnecting}
              testID="alexa-disconnect-confirm-button"
            >
              {isDisconnecting ? <ButtonSpinner color="#F1F5F9" /> : null}
              <ButtonText className="text-ice">{t('familySettings.alexa.disconnect')}</ButtonText>
            </Button>
          </Box>
        </DialogPanel>
      </DialogModal>
    </>
  );
}
