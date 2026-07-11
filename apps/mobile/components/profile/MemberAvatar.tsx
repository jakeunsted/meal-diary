import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useState } from 'react';
import { Image } from 'react-native';
import { SvgUri } from 'react-native-svg';

import { Box } from '@/components/ui/box';

interface MemberAvatarProps {
  avatarUrl?: string | null;
  size?: number;
}

function isRemoteUrl(avatarUrl: string): boolean {
  return /^https?:\/\//.test(avatarUrl);
}

function isSvgAvatarUrl(avatarUrl: string): boolean {
  return avatarUrl.includes('avataaars.io') || /\.svg(\?|$)/i.test(avatarUrl);
}

export function MemberAvatar({ avatarUrl, size = 64 }: MemberAvatarProps) {
  const [hasImageError, setHasImageError] = useState(false);

  const showRemoteAvatar =
    !!avatarUrl && isRemoteUrl(avatarUrl) && !hasImageError;
  const showSvgAvatar = showRemoteAvatar && isSvgAvatarUrl(avatarUrl);
  const showRasterAvatar = showRemoteAvatar && !showSvgAvatar;

  return (
    <Box
      className="items-center justify-center overflow-hidden rounded-full border-2 border-primary bg-base"
      style={{ width: size, height: size }}
    >
      {showSvgAvatar ? (
        <SvgUri
          uri={avatarUrl}
          width={size}
          height={size}
          onError={() => setHasImageError(true)}
        />
      ) : showRasterAvatar ? (
        <Image
          source={{ uri: avatarUrl }}
          style={{ width: size, height: size }}
          resizeMode="cover"
          onError={() => setHasImageError(true)}
        />
      ) : (
        <FontAwesome name="user" size={size * 0.5} color="rgba(241, 245, 249, 0.6)" />
      )}
    </Box>
  );
}
