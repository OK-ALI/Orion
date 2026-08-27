import { Pressable, Text, View } from 'react-native';
import { useCallback, useState } from 'react';
import { styles } from './mediaDetailStyles';

export function EpisodeOverview({ overview, theme }: { overview: string; theme: any }) {
  const [expanded, setExpanded] = useState(false);
  const [measured, setMeasured] = useState(false);
  const [canExpand, setCanExpand] = useState(false);
  const handleMeasure = useCallback((event: any) => {
    setCanExpand(event.nativeEvent.lines.length > 2);
    setMeasured(true);
  }, []);
  return (
    <View style={styles.episodeOverviewBlock}>
      {!measured && (
        <Text
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.episodeOverviewText, styles.episodeOverviewMeasure, { color: theme.textSecondary }]}
          onTextLayout={handleMeasure}
        >
          {overview}
        </Text>
      )}
      <Text
        style={[styles.episodeOverviewText, { color: theme.textSecondary }]}
        numberOfLines={expanded ? undefined : 2}
        ellipsizeMode="tail"
      >
        {overview}
      </Text>
      {canExpand && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={expanded ? 'Show less episode information' : 'Show more episode information'}
          accessibilityState={{ expanded }}
          hitSlop={6}
          style={({ pressed }) => [styles.episodeOverviewToggle, pressed && { opacity: 0.7 }]}
          onPress={(event) => {
            event.stopPropagation();
            setExpanded((value) => !value);
          }}
        >
          <Text style={[styles.episodeOverviewToggleText, { color: theme.accent }]}>
            {expanded ? 'Show less' : 'Show more'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
