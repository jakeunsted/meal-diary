export interface AppleSignInSectionProps {
  label: string;
  buttonType: 'sign-in' | 'sign-up';
  showLegal?: boolean;
  disabled?: boolean;
  /** Where to place the OR divider relative to the Apple button. */
  dividerPosition?: 'above' | 'below' | 'none';
  onSuccess: () => void | Promise<void>;
  onError?: () => void;
  testID?: string;
}
