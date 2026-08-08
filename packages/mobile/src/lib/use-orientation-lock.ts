import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';

/**
 * iPhone stays portrait-only — unchanged product behavior. iPad is left
 * unlocked so the two-pane layout (see use-tablet.ts) can actually show
 * side-by-side in landscape.
 */
export function useOrientationLock(): void {
  useEffect(() => {
    if (Platform.OS !== 'ios') return; // Android keeps its manifest default.
    if (Platform.isPad) {
      ScreenOrientation.unlockAsync().catch(() => {});
    } else {
      ScreenOrientation
        .lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP)
        .catch(() => {});
    }
  }, []);
}
