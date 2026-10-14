'use strict';
// Exact additive v4 presentation/evidence dependencies; updater and subsystem
// engines remain byte-for-byte frozen against the locked Mobile authority.
function productPolishIntegration(file, original) {
  if (file === 'apps/mobile/app.json') return original.replace('\"extra\": {','\"extra\": {\n      \"feedbackEndpoint\": \"https://orion-feedback.okali-orion.workers.dev/v1/feedback\",');
  if (file === "apps/mobile/src/components/SidebarDrawer.tsx") return original
    .replace('ScrollView, Image }', 'ScrollView, Image, useWindowDimensions }')
    .replace('  const router = useRouter();', '  const { fontScale } = useWindowDimensions();\n  const footerStacked = fontScale > 1.3;\n  const router = useRouter();')
    .replace("          <View accessible accessibilityLabel={`Orion Mobile. ${connectionLabel}`} style={[styles.footerCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>\n            <View style={styles.statusRow}>\n              <View style={[styles.statusDot, { backgroundColor: theme[presentation.tone], shadowColor: theme[presentation.tone] }]} />\n              <Text style={[styles.statusText, { color: theme.text }]}>Orion Mobile</Text>\n            </View>\n            <Text style={[styles.versionText, { color: theme.textMuted }]}>\n              {connectionLabel}\n            </Text>\n          </View>", "          <View testID=\"sidebar-shared-footer\" style={[styles.footerCard, footerStacked && styles.footerCardStacked, { backgroundColor: theme.surface, borderColor: theme.border }]}>\n            <View accessible accessibilityLabel={`Orion Mobile. ${connectionLabel}`} style={[styles.footerStatus, footerStacked && styles.footerStatusStacked]}>\n              <View style={styles.statusRow}>\n                <View style={[styles.statusDot, { backgroundColor: theme[presentation.tone], shadowColor: theme[presentation.tone] }]} />\n                <Text style={[styles.statusText, { color: theme.text }]}>Orion Mobile</Text>\n              </View>\n              <Text style={[styles.versionText, { color: theme.textMuted }]}>{connectionLabel}</Text>\n            </View>\n            <Pressable accessibilityRole=\"button\" accessibilityLabel=\"Feedback. Bugs, ideas and feedback\" accessibilityHint=\"Opens the Orion Feedback Center\" onPress={() => handleNavigate('/feedback')}\n              style={({ pressed }) => [styles.footerFeedback, footerStacked && styles.footerFeedbackStacked, { borderColor: theme.border }, pressed && { backgroundColor: theme.surfaceHover }]} >\n              <Ionicons accessible={false} name=\"chatbubble-ellipses-outline\" size={20} color={theme.accent} />\n              <Text style={[styles.footerFeedbackLabel, { color: theme.text }]}>Feedback</Text>\n            </Pressable>\n          </View>")
    .replace('  footerCard: {\n    paddingHorizontal: 16,\n    paddingVertical: 12,', "  footerCard: {\n    flexDirection: 'row',\n    alignItems: 'center',\n    gap: 8,\n    paddingHorizontal: 10,\n    paddingVertical: 6,")
    .replace('  statusRow: {', "  footerCardStacked: { flexDirection: 'column', alignItems: 'stretch' },\n  footerStatus: { flex: 1, minWidth: 0 },\n  footerStatusStacked: { flex: 0 },\n  footerFeedback: { flex: 1, minWidth: 0, minHeight: 44, borderLeftWidth: StyleSheet.hairlineWidth, paddingHorizontal: 8, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },\n  footerFeedbackStacked: { flex: 0, borderLeftWidth: 0, borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 0, justifyContent: 'flex-start' },\n  footerFeedbackLabel: { flexShrink: 1, fontSize: 12, fontFamily: fontFamilies.heading, fontWeight: '700' },\n" + '  statusRow: {')
    .replace('  statusDot: {\n    width: 8,', '  statusDot: {\n    flexShrink: 0,\n    width: 8,');
  if (file === "apps/mobile/tests/p10a2GlobalConnectionPresentation.test.cjs") return original
    .replace("StyleSheet: { create: (styles) => styles, absoluteFill: {} }, Platform: { OS: 'android' }", "StyleSheet: { create: (styles) => styles, absoluteFill: {}, hairlineWidth: 1 }, Platform: { OS: 'android' }, useWindowDimensions: () => ({ fontScale: 1 })")
    .replace("    footer: () =>", "    footerShell: () => nodes(result).find((node) => node.props.testID === 'sidebar-shared-footer'),\n    footer: () =>")
    .replaceAll('style(drawer.footer().props.style)', 'style(drawer.footerShell().props.style)');
  if (file === 'apps/mobile/app/_layout.tsx') return original.replace("import { ReleaseWelcomeBoundary } from '../src/features/releaseWelcome/ReleaseWelcomeBoundary';", "import { ReleaseWelcomeBoundary } from '../src/features/releaseWelcome/ReleaseWelcomeBoundary';\nimport { FeedbackDiagnosticsBridge } from '../src/features/feedback/FeedbackDiagnosticsBridge';")
    .replace('                <MobileDiagnosticsBridge />','                <MobileDiagnosticsBridge />\n                <FeedbackDiagnosticsBridge />');
  if (file === 'apps/mobile/src/services/mobileDiagnostics.ts') return original.replace('export function updateMobileDiagnostics(', `const evidenceListeners = new Set<() => void>();
export function subscribeMobileDiagnosticEvidence(listener: () => void): () => void {
  if (evidenceListeners.size >= 8) return () => {};
  evidenceListeners.add(listener);
  return () => { evidenceListeners.delete(listener); };
}
function publishDiagnosticEvidence() {
  for (const listener of evidenceListeners) { try { listener(); } catch { /* Optional evidence never affects Orion operation. */ } }
}
export function updateMobileDiagnostics(`)
    .replace('  Object.assign(state, update);','  Object.assign(state, update);\n  publishDiagnosticEvidence();')
    .replace('    message: sanitizeDiagnosticText(error.message),\n  };','    message: sanitizeDiagnosticText(error.message),\n  };\n  publishDiagnosticEvidence();');
  if (file === 'apps/mobile/tsconfig.json') return original.replace('    "dist",','    "dist",\n    "feedback-backend",');
  if (file === 'apps/mobile/src/features/settings/UpdatesSettingsContent.tsx') return original
    .replace("import { MobileReleaseNotes } from './MobileReleaseNotes';", "import { ReleaseNotesDialog } from '../releaseNotes/ReleaseNotesDialog';\nimport { releaseNotesFromUpdate } from '../releaseNotes/releaseNotesContent';\nimport type { ReleaseDocument } from '../releaseNotes/releaseNotesModel';")
    .replace('  const [checking, setChecking] = React.useState(false);','  const [checking, setChecking] = React.useState(false);\n  const [notesDocument, setNotesDocument] = React.useState<ReleaseDocument | null>(null);')
    .replace('  const releaseNotes = formatMobileReleaseNotesV1(published?.notes);', `  const releaseNotes = formatMobileReleaseNotesV1(published?.notes);
  const releaseDocument = React.useMemo(() => releaseNotesFromUpdate(currentVersion,
    published && (result?.state === 'available' || published.version === currentVersion) ? { version: published.version, notes: releaseNotes } : null), [currentVersion, published?.version, releaseNotes, result?.state]);`)
    .replace(/      \{releaseNotes \? \([\s\S]*?      \) : null\}/, `      <Pressable accessibilityRole="button" accessibilityLabel="View Release Notes"
        onPress={() => setNotesDocument(releaseDocument)}
        style={({ pressed }) => [styles.notesRow, { borderColor: theme.border, backgroundColor: pressed ? theme.surfaceHover : theme.elevated }]}>
        <Ionicons name="document-text-outline" size={22} color={theme.accent} />
        <View style={{ flex: 1, minWidth: 0 }}><Text style={[styles.notesTitle, { color: theme.text }]}>View Release Notes</Text>
          <Text style={[styles.summaryText, { color: theme.textSecondary }]}>See what's new in Orion {releaseDocument.version}</Text></View>
        <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
      </Pressable>
      <ReleaseNotesDialog document={notesDocument} onClose={() => setNotesDocument(null)} />`)
    .replace("  notes: { borderTopWidth: 1", "  notes: { borderTopWidth: 1")
    .replace('  notes: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing[3], gap: spacing[2] },', "  notesRow: { minHeight: 64, padding: spacing[3], borderWidth: 1, borderRadius: radii.lg, flexDirection: 'row', gap: spacing[3], alignItems: 'center' },")
    .replace("  notesHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },\n",'');
  if (file === 'apps/mobile/tests/p9fReleaseNotesFormatting.test.cjs') return original
    .replace("  assert.match(content, /import \\{ MobileReleaseNotes \\} from '\\.\\/MobileReleaseNotes';/);", "  assert.match(content, /import \\{ ReleaseNotesDialog \\} from '\\.\\.\\/releaseNotes\\/ReleaseNotesDialog';/);")
    .replace('  assert.match(content, /<MobileReleaseNotes notes=\\{releaseNotes\\} \\/>/);','  assert.match(content, /<ReleaseNotesDialog document=\\{notesDocument\\}/);\n  assert.doesNotMatch(content, /<MobileReleaseNotes/);');
  if (file === 'apps/mobile/tests/p94UpdateLifecycle.test.cjs' || file === 'apps/mobile/tests/phase9Polish.test.cjs') return original.replace("assert.match(settings, /What's new/);", 'assert.match(settings, /View Release Notes/);');
  if (file === 'apps/mobile/src/features/playback/animeIdentityDiagnostics.ts') return original.replace('/** At most 64 lines', "const animeEvidenceListeners = new Set<(evidence: Readonly<Record<string, string | number | boolean>>) => void>();\nexport function subscribeAnimeIdentityEvidence(listener: (evidence: Readonly<Record<string, string | number | boolean>>) => void): () => void {\n  if (animeEvidenceListeners.size >= 8) return () => {};\n  animeEvidenceListeners.add(listener);\n  return () => { animeEvidenceListeners.delete(listener); };\n}\nfunction publishAnimeIdentityEvidence(safe: Record<string, string | number | boolean>) {\n  if (!['catalog', 'lookup', 'decision'].includes(String(safe.stage))) return;\n  const { query: _query, ...evidence } = safe;\n  for (const listener of animeEvidenceListeners) { try { listener(Object.freeze({ ...evidence })); } catch { /* Evidence cannot alter identity resolution. */ } }\n}\n\n/** At most 64 lines").replace('    if (!safe) return;\n    try {', '    if (!safe) return;\n    publishAnimeIdentityEvidence(safe);\n    try {');
  return original;
}
module.exports = { productPolishIntegration };
