import { Component, type ReactNode } from 'react';
import { Text, View } from 'react-native';
import { useOrionTheme } from '../../context/ThemeContext';

function GlimpseFailure() {
  const { theme } = useOrionTheme();
  return <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: theme.background }}>
    <Text accessibilityRole="header" style={{ color: theme.text, fontSize: 22 }}>Glimpse is unavailable</Text>
    <Text style={{ color: theme.textSecondary, marginTop: 8 }}>Use Orion navigation to continue browsing.</Text>
  </View>;
}
export class GlimpseBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <GlimpseFailure /> : this.props.children; }
}
