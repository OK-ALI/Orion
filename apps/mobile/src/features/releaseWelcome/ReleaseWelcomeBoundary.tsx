import { useEffect, useRef, useState, type ReactNode } from 'react';
import { BackHandler, View, StyleSheet } from 'react-native';
import Constants from 'expo-constants';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { usePathname, useRootNavigationState, useRouter } from 'expo-router';
import { mmkvStorageAdapter } from '../../services/storageAdapter';
import { qualificationEnabled, subscribeQualification } from './welcomeQualification';
import { completeWelcome, resolveWelcome, shouldCheckWelcome, RELEASE, type Installation } from './welcomeState';
export function ReleaseWelcomeBoundary({ active, children }: { active: boolean; children: ReactNode }) {
  const router = useRouter(); const navigation = useRootNavigationState(); const pathname = usePathname();
  const [attempt, setAttempt] = useState(0); const [phase, setPhase] = useState<'checking' | 'welcome' | 'leaving' | 'handoff' | 'done'>(() => shouldCheckWelcome(mmkvStorageAdapter, Constants.expoConfig?.version, qualificationEnabled()) ? 'checking' : 'done');
  const [destination, setDestination] = useState<'glimpse' | 'home'>('home'); const [error, setError] = useState(false);
  const exitStarted = useRef(false);
  const [qualification, setQualification] = useState(qualificationEnabled);
  useEffect(() => subscribeQualification(() => { exitStarted.current = false; setQualification(true); setPhase('checking'); setAttempt(value => value + 1); }), []);
  useEffect(() => {
    if (phase !== 'checking') return;
    let alive = true;
    void Promise.resolve().then(() => {
      if (qualification) return { version: RELEASE, firstInstallTime: 1, lastUpdateTime: 2 };
      return requireOptionalNativeModule<{ installation(): Promise<Installation> }>('OrionReleaseWelcome')?.installation();
    }).then(value => {
      if (!alive) return;
      const eligible = !!value && resolveWelcome(mmkvStorageAdapter, value, qualification);
      if (alive) setPhase(eligible ? 'welcome' : 'done');
    }).catch(() => { if (alive) setPhase('done'); });
    return () => { alive = false; };
  }, [attempt, qualification, phase]);
  const leave = (next: 'glimpse' | 'home') => {
    if (exitStarted.current) return;
    exitStarted.current = true;
    try { completeWelcome(mmkvStorageAdapter, qualification); setError(false); setDestination(next); setPhase('leaving'); }
    catch { exitStarted.current = false; setError(true); }
  };
  useEffect(() => {
    if (!['welcome', 'leaving', 'handoff'].includes(phase) || !active) return;
    const back = BackHandler.addEventListener('hardwareBackPress', () => { leave('home'); return true; });
    return () => back.remove();
  }, [phase, active, qualification]);
  useEffect(() => {
    if (phase !== 'handoff') return;
    try { if (navigation?.key) router.replace(destination === 'glimpse' ? '/glimpse?welcomeDiscover=1' : '/'); }
    catch { try { router.replace('/'); } catch { /* The existing Home stack remains mounted. */ } setPhase('done'); return; }
    const fallback = setTimeout(() => { try { router.replace('/'); } catch { /* Release the welcome to the existing Home stack. */ } finally { setPhase('done'); } }, 1500);
    return () => clearTimeout(fallback);
  }, [phase, navigation?.key, destination, router]);
  useEffect(() => { if (phase === 'handoff' && (destination === 'glimpse' ? pathname === '/glimpse' : pathname === '/')) setPhase('done'); }, [phase, destination, pathname]);
  useEffect(() => {
    if (phase === 'done' && qualification && pathname === '/release-welcome-test' && navigation?.key) router.replace('/');
  }, [phase, qualification, pathname, navigation?.key, router]);
  if (phase === 'done') return <>{children}</>;
  if (phase === 'checking') return <View style={{ flex: 1 }} accessibilityLabel="Orion is starting" />;
  const Welcome = require('./ReleaseWelcomeScreen').default as typeof import('./ReleaseWelcomeScreen').default;
  return <View style={{ flex: 1 }}>{phase === 'handoff' && children}<View style={StyleSheet.absoluteFill}><Welcome active={active} leaving={phase === 'leaving' || phase === 'handoff'} destination={destination} error={error} onExit={leave} onExitComplete={() => setPhase('handoff')} /></View></View>;
}
