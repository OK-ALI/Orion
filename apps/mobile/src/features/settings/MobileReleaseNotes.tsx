import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { fontSizes, spacing } from '@orion/shared/tokens';
import { useOrionTheme } from '../../context/ThemeContext';

type MobileReleaseNoteBlock =
  | { kind: 'heading'; level: 1 | 2 | 3; text: string }
  | { kind: 'bullet'; text: string }
  | { kind: 'numbered'; marker: string; text: string }
  | { kind: 'quote'; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'divider' };

function cleanInlineMarkdown(value: string): string {
  return value
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/<https?:\/\/[^>]+>/g, '')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/(^|[\s(])[*_]([^*_\n]+)[*_](?=$|[\s).,!?;:])/g, '$1$2')
    .replace(/<[^>]+>/g, '')
    .trim();
}

export function parseMobileReleaseNotesV1(notesValue: string): MobileReleaseNoteBlock[] {
  const notes = String(notesValue || '').replace(/\r\n?/g, '\n').trim();
  if (!notes) return [];

  const blocks: MobileReleaseNoteBlock[] = [];

  for (const rawLine of notes.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;

    if (/^([-*_])\1{2,}$/.test(line)) {
      blocks.push({ kind: 'divider' });
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      blocks.push({
        kind: 'heading',
        level: heading[1].length as 1 | 2 | 3,
        text: cleanInlineMarkdown(heading[2]),
      });
      continue;
    }

    const bullet = line.match(/^[-*+]\s+(.+)$/);
    if (bullet) {
      blocks.push({ kind: 'bullet', text: cleanInlineMarkdown(bullet[1]) });
      continue;
    }

    const numbered = line.match(/^(\d+)[.)]\s+(.+)$/);
    if (numbered) {
      blocks.push({
        kind: 'numbered',
        marker: `${numbered[1]}.`,
        text: cleanInlineMarkdown(numbered[2]),
      });
      continue;
    }

    const quote = line.match(/^>\s*(.+)$/);
    if (quote) {
      blocks.push({ kind: 'quote', text: cleanInlineMarkdown(quote[1]) });
      continue;
    }

    blocks.push({ kind: 'paragraph', text: cleanInlineMarkdown(line) });
  }

  return blocks.filter((block) => block.kind === 'divider' || block.text.length > 0);
}

export function MobileReleaseNotes({ notes }: { notes: string }) {
  const { theme } = useOrionTheme();
  const blocks = React.useMemo(() => parseMobileReleaseNotesV1(notes), [notes]);

  if (!blocks.length) return null;

  return (
    <View style={styles.root}>
      {blocks.map((block, index) => {
        const key = `${block.kind}-${index}`;

        if (block.kind === 'divider') {
          return <View key={key} style={[styles.divider, { backgroundColor: theme.border }]} />;
        }

        if (block.kind === 'heading') {
          return (
            <Text
              key={key}
              accessibilityRole="header"
              style={[
                styles.heading,
                block.level === 1 ? styles.headingOne : block.level === 2 ? styles.headingTwo : styles.headingThree,
                { color: theme.text },
              ]}
            >
              {block.text}
            </Text>
          );
        }

        if (block.kind === 'bullet' || block.kind === 'numbered') {
          return (
            <View key={key} style={styles.listRow}>
              <Text style={[styles.marker, { color: theme.accent }]}>
                {block.kind === 'bullet' ? '•' : block.marker}
              </Text>
              <Text style={[styles.body, styles.listBody, { color: theme.textSecondary }]}>{block.text}</Text>
            </View>
          );
        }

        if (block.kind === 'quote') {
          return (
            <View key={key} style={[styles.quote, { borderLeftColor: theme.accent }]}>
              <Text style={[styles.body, { color: theme.textMuted }]}>{block.text}</Text>
            </View>
          );
        }

        return (
          <Text key={key} style={[styles.body, { color: theme.textSecondary }]}>
            {block.text}
          </Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing[2] },
  heading: { fontWeight: '900' },
  headingOne: { fontSize: fontSizes.sm, lineHeight: 20, marginTop: spacing[2] },
  headingTwo: { fontSize: fontSizes.sm, lineHeight: 20, marginTop: spacing[2] },
  headingThree: { fontSize: fontSizes.xs, lineHeight: 18, marginTop: spacing[2] },
  body: { fontSize: fontSizes.xs, lineHeight: 18 },
  listRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2] },
  marker: { width: 20, flexShrink: 0, fontSize: fontSizes.xs, lineHeight: 18, fontWeight: '900', textAlign: 'right' },
  listBody: { flex: 1, minWidth: 0 },
  quote: { borderLeftWidth: 2, paddingLeft: spacing[3], paddingVertical: spacing[2] },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: spacing[2] },
});
