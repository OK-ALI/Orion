'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { productPolishIntegration } = require('./product-polish-integrations.cjs');
const { animeRepairIntegration } = require('./anime-repair-integrations.cjs');
const ROOT = path.resolve(__dirname, '../../..');
const BASE = '32ea4f75d8ff64975f44507672ad07db477efaf9';
const git = args => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
const normalize = text => text.replace(/\r\n/g, '\n');
const navigation = ['apps/mobile/app/(tabs)/_layout.tsx', 'apps/mobile/src/components/SidebarDrawer.tsx'];

function expectedNavigation(file, original) {
  const insert = (prefix, importLine) => prefix + '\n// GLIMPSE ADDITION BEGIN\n' + importLine + '\n// GLIMPSE ADDITION END';
  if (file === navigation[0]) {
    return original.replace("import { Tabs } from 'expo-router';",
      insert("import { Tabs } from 'expo-router';", "import { isGlimpsePreviewEnabled } from '../../src/features/glimpse/glimpsePreview';"))
      .replace('        <Tabs.Screen name="settings"', '        {/* GLIMPSE ADDITION BEGIN */}\n'
        + '        <Tabs.Screen name="glimpse" options={{ title: \'Glimpse\', href: isGlimpsePreviewEnabled() ? \'/glimpse\' : null }} />\n'
        + '        {/* GLIMPSE ADDITION END */}\n        <Tabs.Screen name="settings"');
  }
  return original.replace("import { useOrionAccount } from '../context/AccountContext';",
    insert("import { useOrionAccount } from '../context/AccountContext';", "import { isGlimpsePreviewEnabled } from '../features/glimpse/glimpsePreview';"))
    .replace("      { id: 'discover', name:", '// GLIMPSE ADDITION BEGIN\n'
      + "      ...(isGlimpsePreviewEnabled() ? [{ id: 'glimpse', name: 'Glimpse', icon: 'play-circle-outline', activeIcon: 'play-circle', route: '/glimpse' }] : []),\n"
      + "// GLIMPSE ADDITION END\n      { id: 'discover', name:");
}

// Exact reviewed integration additions. Existing defaults and section implementations are frozen.
const integrations = [
  'apps/mobile/src/features/library/LibrarySortDialog.tsx',
  'apps/mobile/src/features/settings/settingsArchitecture.ts',
  'apps/mobile/src/features/settings/SettingsSectionNavigator.tsx',
  'apps/mobile/app/(tabs)/settings.tsx',
  'apps/mobile/app/_layout.tsx',
  'apps/mobile/src/services/mobileDiagnostics.ts',
  'apps/mobile/tsconfig.json',
  'apps/mobile/app.json',
  'apps/mobile/src/features/settings/UpdatesSettingsContent.tsx',
  'apps/mobile/tests/p9fReleaseNotesFormatting.test.cjs',
  'apps/mobile/tests/p94UpdateLifecycle.test.cjs',
  'apps/mobile/tests/phase9Polish.test.cjs',
  'apps/mobile/src/features/playback/animeIdentityDiagnostics.ts',
  "apps/mobile/tests/p10a2GlobalConnectionPresentation.test.cjs",
  "packages/shared/src/api/animeLookup.ts",
  "apps/mobile/metro.config.js",
  "apps/mobile/src/features/playback/EmbedPlayerSurface.tsx",
  "apps/mobile/src/features/playback/useAnimeReadiness.ts",
  "apps/mobile/src/features/playback/animeReadiness.ts",
  "apps/mobile/src/features/library/sourceAffinity.ts",
  "apps/mobile/tests/animeProductization.test.cjs",
  "apps/mobile/src/features/playback/animeIdentityRequest.ts",
  "apps/mobile/src/features/playback/useAnimeSource.ts",
  "apps/mobile/src/features/playback/AnimeSourceChoices.tsx",
  "apps/mobile/src/features/playback/PlayerScreen.tsx",
];
function expectedIntegration(file, original) {
  if (file === integrations[0]) return original
    .replace('interface LibrarySortDialogProps {', 'interface LibrarySortDialogProps {\n  eyebrow?: string;')
    .replace('export function LibrarySortDialog({', "export function LibrarySortDialog({\n  eyebrow = 'MY LIST',")
    .replace('}>MY LIST</Text>', '}>{eyebrow}</Text>');
  if (file === integrations[1]) return "import { isGlimpsePreviewEnabled } from '../glimpse/glimpsePreview';\n" + original
    .replace("  | 'downloads';", "  | 'downloads'\n  | 'glimpse';")
    .replace("  { id: 'downloads', label: 'Downloads', status: 'active' },", "  { id: 'downloads', label: 'Downloads', status: 'active' },\n  { id: 'glimpse', label: 'Glimpse', status: isGlimpsePreviewEnabled() ? 'active' : 'reserved' },");
  if (file === integrations[2]) return original.replace("  updates: 'cloud-download-outline',", "  updates: 'cloud-download-outline',\n  glimpse: 'play-circle-outline',");
  if (file === integrations[3]) return original
    .replace("  const { section: requestedSectionParam } = useLocalSearchParams<{ section?: string | string[] }>();", "  const { section: requestedSectionParam, glimpseEntry: glimpseEntryParam } = useLocalSearchParams<{ section?: string | string[]; glimpseEntry?: string }>();")
    .replace('[jumpToSection, orderedSections, requestedSectionParam]', '[jumpToSection, orderedSections, requestedSectionParam, glimpseEntryParam]')
    .replace('    scrollRef.current?.scrollTo({ y: Math.max(0, y - spacing[2]), animated: !motion.reduceMotion });',
      "    if (sectionId === 'glimpse') {\n      scrollRef.current?.scrollTo({ y: Math.max(0, y - spacing[2]), animated: false });\n      return;\n    }\n    scrollRef.current?.scrollTo({ y: Math.max(0, y - spacing[2]), animated: !motion.reduceMotion });")
    .replace('import { DownloadSettingsContent } from "../../src/features/downloads/DownloadSettingsContent";',
      'import { DownloadSettingsContent } from "../../src/features/downloads/DownloadSettingsContent";\nimport { isGlimpsePreviewEnabled } from "../../src/features/glimpse/glimpsePreview";')
    .replace('  const pendingDeepLinkSectionRef = React.useRef<MobileSettingsSectionId | null>(null);',
      '  const pendingDeepLinkSectionRef = React.useRef<MobileSettingsSectionId | null>(null);\n  const glimpseContentJumpPendingRef = React.useRef(false);')
    .replace('    const y = sectionOffsets.current[section.id];',
      "    const y = sectionOffsets.current[section.id];\n    glimpseContentJumpPendingRef.current = section.id === 'glimpse' && typeof y !== 'number';")
    .replace('        onScroll={handleScroll}', `        onContentSizeChange={() => {
          if (!glimpseContentJumpPendingRef.current || typeof sectionOffsets.current.glimpse !== 'number') return;
          glimpseContentJumpPendingRef.current = false;
          requestAnimationFrame(() => jumpToSection('glimpse'));
        }}
        onScroll={handleScroll}`)
    .replace('      default:\n        return null;', `      case 'glimpse': {
        if (!isGlimpsePreviewEnabled()) return null;
        const { GlimpseSettingsContent } = require('../../src/features/glimpse/GlimpseSettingsContent') as typeof import('../../src/features/glimpse/GlimpseSettingsContent');
        return (
          <SettingsSection sectionId="glimpse" title="Glimpse" description="Choose how you explore clips."
            theme={theme} onLayout={recordSectionLayout('glimpse')}>
            <GlimpseSettingsContent />
          </SettingsSection>
        );
      }
      default:
        return null;`);
  if (file === integrations[4]) return original
    .replace("import { Stack } from 'expo-router';", "import { Stack } from 'expo-router';\nimport { ReleaseWelcomeBoundary } from '../src/features/releaseWelcome/ReleaseWelcomeBoundary';")
    .replace('                <MobileNotificationResponseRouter />\n', '')
    .replace('                <Stack\n', '                <ReleaseWelcomeBoundary active={!showStartup}>\n                  <MobileNotificationResponseRouter />\n                <Stack\n')
    .replace('                <OfflineBanner />', '                <OfflineBanner />\n                </ReleaseWelcomeBoundary>');
  if (integrations.slice(5).includes(file)) return original;
  throw new Error('Unknown reviewed integration: ' + file);
}
function allowedAddition(file) {
  return file === "apps/mobile/scripts/anime-repair-integrations.cjs"
    || file === "apps/mobile/src/features/playback/animePublicEvidence.ts"
    || file === "apps/mobile/src/features/playback/animeEpisodeProof.ts"
    || file === "apps/mobile/src/features/playback/animeCanonicalRepair.ts"
    || file === "apps/mobile/src/features/playback/animeMediaShape.ts"
    || file === "apps/mobile/tests/animeV4CanonicalRepair.test.cjs"
    || file === "docs/mobile-v4-anime-repair-audit.md"
    || file.startsWith('apps/mobile/src/features/feedback/')
    || file.startsWith('apps/mobile/src/features/releaseNotes/')
    || file.startsWith('apps/mobile/modules/orion-feedback/')
    || file.startsWith('apps/mobile/feedback-backend/')
    || file === 'apps/mobile/app/feedback.tsx'
    || file === 'apps/mobile/app/feedback-retry-test.tsx'
    || file === 'apps/mobile/scripts/product-polish-integrations.cjs'
    || file === 'apps/mobile/tests/productPolish.test.cjs'
    || file === 'docs/mobile-v4-product-polish-audit.md'
    || file.startsWith('apps/mobile/src/features/releaseWelcome/')
    || file.startsWith('apps/mobile/modules/orion-release-welcome/')
    || file === 'apps/mobile/app/release-welcome-test.tsx'
    || file === 'apps/mobile/app/release-notes-test.tsx'
    || file === 'apps/mobile/tests/releaseWelcome.test.cjs'
    || file === 'docs/mobile-v4-release-welcome-audit.md'
    || file.startsWith('apps/mobile/src/features/glimpse/')
    || file.startsWith('apps/mobile/modules/orion-glimpse-ambient/')
    || /^apps\/mobile\/tests\/glimpse[^/]*\.test\.cjs$/.test(file)
    || file === 'apps/mobile/app/(tabs)/glimpse.tsx'
    || file === 'apps/mobile/scripts/check-glimpse-preservation.cjs'
    || file === 'apps/mobile/scripts/build-glimpse-physical.cjs'
    || file === 'apps/mobile/scripts/glimpse-internal-transform.cjs'
    || file === 'docs/mobile-v4-glimpse-audit.md';
}
function checkPreservation() {
  const tracked = git(['ls-tree', '-r', '--name-only', BASE]).split('\n');
  const baselineSet = new Set(tracked);
  const changed = git(['diff', '--name-only', BASE, '--']).split('\n').filter(Boolean);
  const additions = git(['ls-files', '--others', '--exclude-standard']).split('\n').filter(Boolean);
  for (const file of changed) {
    if (baselineSet.has(file) && ![...navigation, ...integrations].includes(file)) throw new Error('Locked file changed: ' + file);
    if (!baselineSet.has(file) && !allowedAddition(file)) throw new Error('Out-of-scope addition: ' + file);
  }
  for (const file of additions) if (!allowedAddition(file)) throw new Error('Out-of-scope untracked file: ' + file);
  for (const file of [...navigation, ...integrations]) {
    const original = normalize(execFileSync('git', ['show', BASE + ':' + file], { cwd: ROOT, encoding: 'utf8' }));
    const actual = normalize(fs.readFileSync(path.join(ROOT, file), 'utf8'));
    if (actual !== animeRepairIntegration(file, productPolishIntegration(file, navigation.includes(file) ? expectedNavigation(file, original) : expectedIntegration(file, original)))) throw new Error('Navigation differs beyond the reviewed Glimpse addition: ' + file);
  }
  return { authority: BASE, frozenBaselineFiles: tracked.length - navigation.length - integrations.length, navigationAdditions: navigation.length, reviewedIntegrations: integrations.length,
    newFiles: [...new Set([...changed.filter(file => !baselineSet.has(file)), ...additions])].length };
}
module.exports = { checkPreservation, expectedNavigation, expectedIntegration, integrations };
if (require.main === module) {
  try { console.log(JSON.stringify(checkPreservation(), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
