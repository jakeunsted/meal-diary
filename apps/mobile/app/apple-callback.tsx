import { useEffect } from 'react';
import { Platform } from 'react-native';

import { Box } from '@/components/ui/box';
import { initAppleWebPopup } from '@/lib/auth/appleWeb';

/** Popup return page for Sign in with Apple on the web. */
export default function AppleCallbackScreen() {
  useEffect(() => {
    if (Platform.OS !== 'web') {
      return;
    }
    void initAppleWebPopup();
  }, []);

  return <Box className="flex-1 bg-base" />;
}
