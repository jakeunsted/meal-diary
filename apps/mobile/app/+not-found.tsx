import { Link, Stack } from 'expo-router';

import { Box } from '@/components/ui/box';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <Box className="flex-1 items-center justify-center bg-base px-6">
        <Heading size="xl" className="text-ice mb-4">
          This screen does not exist.
        </Heading>
        <Link href="/">
          <Text className="text-primary">Go to home screen</Text>
        </Link>
      </Box>
    </>
  );
}
