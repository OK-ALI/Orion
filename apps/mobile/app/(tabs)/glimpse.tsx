import { Redirect } from 'expo-router';
import { lazy, Suspense } from 'react';
import { ActivityIndicator } from 'react-native';
import { isGlimpsePreviewEnabled } from '../../src/features/glimpse/glimpsePreview';
import { GlimpseBoundary } from '../../src/features/glimpse/GlimpseBoundary';

const GlimpseScreen = lazy(() => import('../../src/features/glimpse/GlimpseScreen'));
export default function GlimpseRoute() {
  if (!isGlimpsePreviewEnabled()) return <Redirect href="/" />;
  return <GlimpseBoundary><Suspense fallback={<ActivityIndicator accessibilityLabel="Opening Glimpse" />}>
    <GlimpseScreen />
  </Suspense></GlimpseBoundary>;
}
