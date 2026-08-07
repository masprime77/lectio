// Renders one of the bundled legal-document fragments (Impressum / Privacy
// Policy) in a WebView, wrapped in the same minimal typography shell the
// desktop app uses for its legal windows, for a consistent look across
// platforms. The fragments are bundled assets (see metro.config.js), so they
// render fully offline.
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { WebView } from 'react-native-webview';
import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import { useTheme } from '../../../src/theme';
import impressumEn from '../../../assets/legal/impressum.en.html';
import datenschutzEn from '../../../assets/legal/datenschutzerklaerung.en.html';

// English is the only UI language today (no locale toggle exists anywhere in
// the app yet) — see docs/legal/README.md for the German originals.
const DOCS: Record<string, { module: number; title: string }> = {
  impressum: { module: impressumEn, title: 'Impressum' },
  datenschutz: { module: datenschutzEn, title: 'Privacy Policy' },
};

function wrapInShell(fragment: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      body { font-family: -apple-system, Roboto, sans-serif; padding: 16px 20px;
             line-height: 1.5; }
      h1 { font-size: 1.4em; }
      h2 { font-size: 1.1em; }
    </style></head><body>${fragment}</body></html>`;
}

export default function LegalDocScreen() {
  const theme = useTheme();
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const entry = doc ? DOCS[doc] : undefined;
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    if (!entry) return;
    let cancelled = false;
    (async () => {
      const asset = Asset.fromModule(entry.module);
      await asset.downloadAsync();
      const fragment = await new File(asset.localUri!).text();
      if (!cancelled) setHtml(wrapInShell(fragment));
    })();
    return () => {
      cancelled = true;
    };
  }, [entry]);

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ title: entry?.title ?? 'Legal' }} />
      {html ? (
        <WebView originWhitelist={['*']} source={{ html }} style={styles.webview} />
      ) : (
        <ActivityIndicator color={theme.accent} style={styles.loading} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  webview: { flex: 1, backgroundColor: 'transparent' },
  loading: { flex: 1 },
});
