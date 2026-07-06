import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Image } from 'react-native';

import { Box } from '@/components/ui/box';

interface MemberAvatarProps {
  avatarUrl?: string | null;
  size?: number;
}

export function MemberAvatar({ avatarUrl, size = 64 }: MemberAvatarProps) {
  // Relative paths (e.g. /temp-avatars/...) are web assets we can't load here
  const isRemoteUrl = !!avatarUrl && /^https?:\/\//.test(avatarUrl);

  return (
    <Box
      className="items-center justify-center overflow-hidden rounded-full border-2 border-primary bg-base"
      style={{ width: size, height: size }}
    >
      {isRemoteUrl ? (
        <Image
          source={{ uri: avatarUrl }}
          style={{ width: size, height: size }}
          resizeMode="cover"
        />
      ) : (
        <FontAwesome name="user" size={size * 0.5} color="rgba(241, 245, 249, 0.6)" />
      )}
    </Box>
  );
}
