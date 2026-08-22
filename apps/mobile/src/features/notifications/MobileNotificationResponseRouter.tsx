import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { resolveMobileNotificationTargetV1 } from '../../services/mobileNotifications';

export function MobileNotificationResponseRouter() {
  const router = useRouter();
  const handledRef = useRef<string | null>(null);

  useEffect(() => {
    if (Platform.OS === 'web') return undefined;
    let active = true;
    let subscription: { remove: () => void } | null = null;

    const handleNotification = (notification: any) => {
      const requestId = String(notification?.request?.identifier || '');
      if (requestId && handledRef.current === requestId) return;
      const target = resolveMobileNotificationTargetV1(notification?.request?.content?.data);
      if (!target) return;
      handledRef.current = requestId || handledRef.current;
      if (target.target === 'home') {
        router.push('/');
      } else if (target.target === 'settings') {
        router.push({ pathname: '/(tabs)/settings', params: { section: target.section } });
      } else {
        router.push({
          pathname: '/media/[id]',
          params: { id: target.mediaId, type: target.mediaType },
        });
      }
    };

    void import('expo-notifications').then((Notifications) => {
      if (!active) return;
      const last = Notifications.getLastNotificationResponse();
      if (last?.notification) handleNotification(last.notification);
      subscription = Notifications.addNotificationResponseReceivedListener((response) => {
        handleNotification(response.notification);
      });
    }).catch(() => {});

    return () => {
      active = false;
      subscription?.remove();
    };
  }, [router]);

  return null;
}
