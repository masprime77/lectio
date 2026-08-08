import { useWindowDimensions } from 'react-native';

// Below this width the two-pane iPad layout collapses to the phone's
// single-column navigation. This also covers narrow iPad multitasking
// (Split View / Slide Over), which is intentional — those should behave
// like a phone, not a stretched two-pane tablet.
const TABLET_BREAKPOINT = 768;

export function useIsTablet(): boolean {
  const { width } = useWindowDimensions();
  return width >= TABLET_BREAKPOINT;
}
