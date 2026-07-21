import type { ReactNode } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors } from '@/constants/theme';

/** Opacity via style — Tailwind bg-black/* is unreliable inside RN Modal. */
export const dialogBackdropStyle: StyleProp<ViewStyle> = {
  backgroundColor: 'rgba(0, 0, 0, 0.75)',
};

export const dialogPanelStyle: ViewStyle = {
  width: '100%',
  borderRadius: 16,
  padding: 24,
  backgroundColor: colors.surface,
};

export const dialogPanelShadowStyle: StyleProp<ViewStyle> = Platform.select({
  ios: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.55,
    shadowRadius: 28,
  },
  android: {
    elevation: 24,
  },
  default: {},
});

export type DialogModalPlacement = 'center' | 'bottom' | 'topEnd';

interface DialogModalProps {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  testID?: string;
  placement?: DialogModalPlacement;
}

const placementClassNames: Record<DialogModalPlacement, string> = {
  center: 'items-center justify-center px-6',
  bottom: 'justify-end px-6',
  topEnd: 'items-end justify-start px-4 pt-24',
};

export function DialogModal({
  visible,
  onClose,
  children,
  testID,
  placement = 'center',
}: DialogModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      testID={testID}
    >
      <View className="flex-1">
        <Pressable
          style={[StyleSheet.absoluteFill, dialogBackdropStyle]}
          onPress={onClose}
          accessibilityRole="button"
        />
        <View
          className={`flex-1 ${placementClassNames[placement]}`}
          pointerEvents="box-none"
        >
          {children}
        </View>
      </View>
    </Modal>
  );
}

interface DialogPanelProps {
  children: ReactNode;
  className?: string;
  style?: StyleProp<ViewStyle>;
}

export function DialogPanel({
  children,
  className,
  style,
}: DialogPanelProps) {
  return (
    <View className={className} style={[dialogPanelStyle, dialogPanelShadowStyle, style]}>
      {children}
    </View>
  );
}
