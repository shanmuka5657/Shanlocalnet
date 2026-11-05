import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

/**
 * LocalNet Native & Web Haptics Engine
 * Provides physical tactile feedback via Capacitor Haptics on Android/iOS
 * with automatic fallback to navigator.vibrate on mobile browsers.
 */

export const triggerHaptic = async (
  type: 'light' | 'medium' | 'heavy' | 'success' | 'doubleTap' | 'warning' = 'light'
) => {
  try {
    switch (type) {
      case 'light':
        await Haptics.impact({ style: ImpactStyle.Light });
        break;
      case 'medium':
        await Haptics.impact({ style: ImpactStyle.Medium });
        break;
      case 'heavy':
        await Haptics.impact({ style: ImpactStyle.Heavy });
        break;
      case 'doubleTap':
        await Haptics.impact({ style: ImpactStyle.Medium });
        setTimeout(() => Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {}), 80);
        break;
      case 'success':
        await Haptics.notification({ type: NotificationType.Success });
        break;
      case 'warning':
        await Haptics.notification({ type: NotificationType.Warning });
        break;
    }
  } catch {
    // Graceful web fallback
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        if (type === 'light') navigator.vibrate(8);
        else if (type === 'medium') navigator.vibrate(15);
        else if (type === 'heavy') navigator.vibrate(25);
        else if (type === 'doubleTap') navigator.vibrate([15, 45, 20]);
        else if (type === 'success') navigator.vibrate([12, 40, 18]);
        else if (type === 'warning') navigator.vibrate([30, 60, 30]);
      } catch {}
    }
  }
};
