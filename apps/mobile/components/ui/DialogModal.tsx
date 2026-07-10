import type { ReactNode } from 'react';
import { Modal, Platform, Pressable, type StyleProp, type ViewStyle } from 'react-native';

/** Opacity via style — Tailwind bg-black/* is unreliable inside RN Modal. */
export const dialogBackdropStyle: StyleProp<ViewStyle> = {
  backgroundColor: 'rgba(0, 0, 0, 0.15)',
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
  bottom: 'justify-end',
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
      <Pressable
        className={`flex-1 ${placementClassNames[placement]}`}
        style={dialogBackdropStyle}
        onPress={onClose}
      >
        {children}
      </Pressable>
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
  className = 'w-full rounded-2xl bg-surface p-6',
  style,
}: DialogPanelProps) {
  return (
    <Pressable
      className={className}
      style={[dialogPanelShadowStyle, style]}
      onPress={() => {}}
    >
      {children}
    </Pressable>
  );
}
