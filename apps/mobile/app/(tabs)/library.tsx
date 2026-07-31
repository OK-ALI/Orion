import { View, Text, StyleSheet, FlatList, Pressable, Platform, Dimensions, Alert } from 'react-native';
import { useState, useMemo } from 'react';
import { useLibrary } from '../../src/context/LibraryContext';
import { backgrounds, spacing, fontSizes, fontFamilies, text, accent, radii } from '@orion/shared/tokens';
import { MediaCard } from '../../src/components/MediaCard';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const numColumns = Platform.OS === 'web' ? Math.floor(SCREEN_WIDTH / 150) : 3;
const cardWidth = (SCREEN_WIDTH - (spacing[4] * 2) - (spacing[2] * (numColumns - 1))) / numColumns;

export default function LibraryScreen() {
  const { saved, savedOrder, watched, clearHistory } = useLibrary();
  const [activeTab, setActiveTab] = useState<'saved' | 'history'>('saved');
  const router = useRouter();

  const savedItems = useMemo(() => {
    return savedOrder.map(key => saved[key]).filter(Boolean);
  }, [saved, savedOrder]);

  const watchedItems = useMemo(() => {
    return Object.values(watched)
      .filter((item: any) => item && item.id && item.timestamp)
      .sort((a: any, b: any) => b.timestamp - a.timestamp);
  }, [watched]);

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={[styles.container, { paddingTop: 16 }]}>
        <Text style={styles.pageTitle}>Library</Text>
        <View style={styles.tabsRow}>
          <View style={styles.tabsLeft}>
            <Pressable 
              style={[styles.tab, activeTab === 'saved' && styles.activeTab]}
              onPress={() => setActiveTab('saved')}
            >
              <Ionicons name="bookmark" size={16} color={activeTab === 'saved' ? accent.primary : text.muted} />
              <Text style={[styles.tabText, activeTab === 'saved' && styles.activeTabText]}>My List</Text>
            </Pressable>
            <Pressable 
              style={[styles.tab, activeTab === 'history' && styles.activeTab]}
              onPress={() => setActiveTab('history')}
            >
              <Ionicons name="time" size={16} color={activeTab === 'history' ? accent.primary : text.muted} />
              <Text style={[styles.tabText, activeTab === 'history' && styles.activeTabText]}>History</Text>
            </Pressable>
          </View>

          {activeTab === 'history' && watchedItems.length > 0 && (
            <Pressable 
              style={styles.clearBtn} 
              onPress={() => {
                Alert.alert(
                  'Clear Watch History',
                  'Are you sure you want to clear your entire watch history? This cannot be undone.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Clear', style: 'destructive', onPress: clearHistory }
                  ]
                );
              }}
            >
              <Ionicons name="trash-outline" size={16} color={text.muted} />
            </Pressable>
          )}
        </View>

        {activeTab === 'saved' ? (
          <FlatList
            data={savedItems}
            keyExtractor={item => `${item.id}_${item.media_type}`}
            numColumns={numColumns}
            contentContainerStyle={styles.listContent}
            columnWrapperStyle={styles.columnWrapper}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="bookmark-outline" size={64} color="rgba(255,255,255,0.1)" />
                <Text style={styles.emptyText}>Your list is empty</Text>
                <Text style={styles.emptySubText}>Use the 'My List' button on movies and series to add them here.</Text>
              </View>
            }
            renderItem={({ item }) => (
              <MediaCard 
                item={item} 
                width={cardWidth} 
                height={cardWidth * 1.5} 
                style={{ marginRight: 0 }}
                onPress={() => router.push({
                  pathname: '/media/[id]',
                  params: { id: item.id, type: item.media_type || 'movie' }
                })}
              />
            )}
          />
        ) : (
          <FlatList
            data={watchedItems}
            keyExtractor={item => `history_${item.id}_${item.is_episode ? 'ep' : ''}`}
            numColumns={numColumns}
            contentContainerStyle={styles.listContent}
            columnWrapperStyle={styles.columnWrapper}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="time-outline" size={64} color="rgba(255,255,255,0.1)" />
                <Text style={styles.emptyText}>No watch history</Text>
                <Text style={styles.emptySubText}>Items you watch will automatically appear here.</Text>
              </View>
            }
            renderItem={({ item }) => (
              <MediaCard 
                item={item} 
                width={cardWidth} 
                height={cardWidth * 1.5} 
                style={{ marginRight: 0 }}
                onPress={() => {
                  if (item.is_episode && item.series_id) {
                    router.push({
                      pathname: '/media/[id]',
                      params: { id: String(item.series_id), type: 'tv' }
                    });
                  } else {
                    router.push({
                      pathname: '/media/[id]',
                      params: { id: item.id, type: item.media_type || 'movie' }
                    });
                  }
                }}
              />
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: backgrounds.base,
  },
  container: {
    flex: 1,
    backgroundColor: backgrounds.base,
  },
  pageTitle: {
    color: '#ffffff',
    fontSize: 28,
    fontFamily: fontFamilies.display,
    fontWeight: '800',
    paddingHorizontal: spacing[4],
    marginBottom: spacing[4],
    marginLeft: 48, // Make room for the floating sidebar trigger
  },
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  tabsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clearBtn: {
    padding: spacing[2],
    borderRadius: radii.full,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[4],
    marginRight: spacing[2],
    borderRadius: radii.full,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  activeTab: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  tabText: {
    color: text.muted,
    fontSize: fontSizes.sm,
    fontWeight: '600',
  },
  activeTabText: {
    color: text.primary,
  },
  listContent: {
    padding: spacing[4],
    gap: spacing[2],
  },
  columnWrapper: {
    gap: spacing[2],
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[8],
    marginTop: 100,
  },
  emptyText: {
    color: text.primary,
    fontSize: fontSizes.lg,
    fontWeight: '700',
    marginTop: spacing[4],
  },
  emptySubText: {
    color: text.secondary,
    fontSize: fontSizes.sm,
    textAlign: 'center',
    marginTop: spacing[2],
  },
});
