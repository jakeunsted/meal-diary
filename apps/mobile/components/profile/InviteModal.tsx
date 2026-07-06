import FontAwesome from '@expo/vector-icons/FontAwesome';
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, TextInput } from 'react-native';

import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { env } from '@/constants/env';

interface InviteModalProps {
  visible: boolean;
  familyGroupCode: string;
  onClose: () => void;
}

export function InviteModal({ visible, familyGroupCode, onClose }: InviteModalProps) {
  const { t } = useTranslation();
  const [hasCopied, setHasCopied] = useState(false);

  const inviteLink = `${env.webUrl}/registration/step-1?code=${familyGroupCode}`;

  const handleCopyLink = async () => {
    await Clipboard.setStringAsync(inviteLink);
    setHasCopied(true);
    setTimeout(() => setHasCopied(false), 2000);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 items-center justify-center bg-black/60 px-6" onPress={onClose}>
        <Pressable className="w-full rounded-2xl bg-surface p-6" onPress={() => {}}>
          <Heading size="lg" className="text-ice mb-3">
            {t('profile.inviteTitle')}
          </Heading>
          <Text className="text-ice/70 mb-4">{t('profile.inviteDescription')}</Text>

          <Pressable
            onPress={handleCopyLink}
            className="mb-4 flex-row items-start gap-3 rounded-lg bg-base px-4 py-3"
            testID="profile-copy-invite-link-button"
          >
            <TextInput
              value={inviteLink}
              editable={false}
              multiline
              scrollEnabled={false}
              className="text-ice min-w-0 flex-1 shrink bg-transparent p-0 font-mono text-xs"
              testID="profile-invite-link-input"
            />
            <Box className="shrink-0 pt-0.5">
              <FontAwesome
                name={hasCopied ? 'check' : 'copy'}
                size={16}
                color={hasCopied ? '#2ECCA6' : 'rgba(241, 245, 249, 0.7)'}
              />
            </Box>
          </Pressable>

          {hasCopied && (
            <Text className="text-accent mb-2 text-center text-sm">
              {t('profile.linkCopied')}
            </Text>
          )}

          <Button variant="outline" onPress={onClose}>
            <ButtonText>{t('common.close')}</ButtonText>
          </Button>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
