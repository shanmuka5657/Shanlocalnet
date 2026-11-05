/**
 * LocalNet Mobile Touch Haptics Engine
 * Provides subtle tactile feedback on mobile devices using navigator.vibrate
 */

export const triggerHaptic = (
  type: 'light' | 'medium' | 'heavy' | 'success' | 'doubleTap' | 'warning' = 'light'
) => {
  if (typeof window === 'undefined' || !('vibrate' in navigator)) return;

  try {
    switch (type) {
      case 'light':
        // Micro-tick for scrubber drags, slider moves, tab changes (8ms)
        navigator.vibrate(8);
        break;
      case 'medium':
        // Button press, bookmark save, follow (15ms)
        navigator.vibrate(15);
        break;
      case 'heavy':
        // Create post publish, modal open (25ms)
        navigator.vibrate(25);
        break;
      case 'doubleTap':
        // Double-pulse heart bounce for double-tap video like
        navigator.vibrate([15, 45, 20]);
        break;
      case 'success':
        // Pull-to-refresh triggered, order placed
        navigator.vibrate([12, 40, 18]);
        break;
      case 'warning':
        // Discard / delete confirmation
        navigator.vibrate([30, 60, 30]);
        break;
    }
  } catch {
    // Gracefully ignore if browser blocks vibration without direct user interaction
  }
};

