// Minimal light/dark color tokens, mirroring the desktop's Light/Dark intent
// without porting its CSS. Tag colors come from the semester data, not here.
import { useColorScheme } from 'react-native';

export interface Theme {
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  track: string;
}

const light: Theme = {
  background: '#f5f6f8',
  surface: '#ffffff',
  surfaceAlt: '#f0f1f4',
  border: '#e2e4e9',
  text: '#1a1c20',
  muted: '#6b7280',
  accent: '#4a90d9',
  track: '#e6e8ec',
};

const dark: Theme = {
  background: '#16181d',
  surface: '#1f222a',
  surfaceAlt: '#262a33',
  border: '#323742',
  text: '#f2f3f5',
  muted: '#9aa3b2',
  accent: '#5a9ee6',
  track: '#323742',
};

export const themes = { light, dark };

/** Resolve the active theme from the OS color scheme (defaults to light). */
export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}
