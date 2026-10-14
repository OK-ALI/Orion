import { useEffect } from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { GLIMPSE_INTERNAL_PREVIEW } from '../src/features/glimpse/glimpseBuild';
import { resetWelcomeQualification } from '../src/features/releaseWelcome/welcomeQualification';
export default function WelcomeQualificationRoute() {
  const { request } = useLocalSearchParams<{ request?: string }>();
  const valid = typeof request === 'string' && /^[a-z0-9-]{1,64}$/.test(request);
  useEffect(() => { if (GLIMPSE_INTERNAL_PREVIEW && valid) resetWelcomeQualification(request); }, [request, valid]);
  return GLIMPSE_INTERNAL_PREVIEW && valid ? null : <Redirect href="/" />;
}
