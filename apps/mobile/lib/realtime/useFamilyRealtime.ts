import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';

import { queryClient } from '@/lib/api/queryClient';
import { useAuthStore } from '@/lib/auth/authStore';
import { applyFamilyRealtimeEvent } from '@/lib/realtime/applyFamilyRealtimeEvent';
import {
  connectFamilySse,
  type FamilySseConnection,
} from '@/lib/realtime/sseClient';

const RECONNECT_DELAY_MS = 5000;

export function useFamilyRealtime(): void {
  const status = useAuthStore((state) => state.status);
  const familyGroupId = useAuthStore((state) => state.user?.family_group_id);
  const userId = useAuthStore((state) => state.user?.id);
  const connectionRef = useRef<FamilySseConnection | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generationRef = useRef(0);

  useEffect(() => {
    const generation = ++generationRef.current;

    const clearReconnect = () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };

    const closeConnection = () => {
      clearReconnect();
      connectionRef.current?.close();
      connectionRef.current = null;
    };

    const scheduleReconnect = () => {
      if (generation !== generationRef.current) {
        return;
      }
      clearReconnect();
      reconnectTimeoutRef.current = setTimeout(() => {
        void openConnection();
      }, RECONNECT_DELAY_MS);
    };

    const openConnection = async () => {
      if (generation !== generationRef.current) {
        return;
      }
      if (status !== 'signedIn' || !familyGroupId) {
        closeConnection();
        return;
      }

      closeConnection();

      try {
        const connection = await connectFamilySse({
          familyGroupId,
          onMessage: (message) => {
            applyFamilyRealtimeEvent(
              queryClient,
              familyGroupId,
              message.type,
              message.data,
              userId
            );
          },
          onError: scheduleReconnect,
        });

        if (generation !== generationRef.current) {
          connection.close();
          return;
        }

        connectionRef.current = connection;
      } catch (error) {
        console.error('[SSE] Failed to connect:', error);
        scheduleReconnect();
      }
    };

    void openConnection();

    const handleResume = () => {
      if (status !== 'signedIn' || !familyGroupId) {
        return;
      }
      void openConnection();
    };

    let removeResumeListener: (() => void) | undefined;

    if (Platform.OS === 'web') {
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          handleResume();
        }
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);
      removeResumeListener = () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    } else {
      const subscription = AppState.addEventListener('change', (nextState) => {
        if (nextState === 'active') {
          handleResume();
        }
      });
      removeResumeListener = () => subscription.remove();
    }

    return () => {
      generationRef.current += 1;
      removeResumeListener?.();
      closeConnection();
    };
  }, [familyGroupId, status, userId]);
}
