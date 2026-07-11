import { ActivityIndicator } from 'react-native';

import { MemberAvatar } from '@/components/profile/MemberAvatar';
import { Box } from '@/components/ui/box';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import type { User } from '@/types/api';

interface ProfileHeaderProps {
  user: User | null | undefined;
  isLoading: boolean;
  error: string | null;
}

function getFullName(user: User): string {
  return `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || user.username;
}

export function ProfileHeader({ user, isLoading, error }: ProfileHeaderProps) {
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

  return (
    <Box className="mb-8 items-center">
      <Box className="mb-4">
        <MemberAvatar avatarUrl={user.avatar_url} size={128} />
      </Box>
      <Heading size="xl" className="text-ice text-center">
        {getFullName(user)}
      </Heading>
    </Box>
  );
}
