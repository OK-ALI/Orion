import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { createDiscoverStyles } from './discoverStyles';
import type { MobileThemeTokens } from '../../context/ThemeContext';

export type FilterOption = { id: string; label: string };

export function DiscoverFilterModal({ theme, visible, title, options, selected, onSelect, onClose }: {
  theme: MobileThemeTokens;
  visible: boolean;
  title: string;
  options: FilterOption[];
  selected: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const styles = useMemo(() => createDiscoverStyles(theme), [theme]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <View accessibilityViewIsModal style={styles.modalContent} onStartShouldSetResponder={() => true}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close filter options" hitSlop={4}
              onPress={onClose} style={styles.modalCloseBtn}>
              <Ionicons name="close" size={20} color={theme.text} />
            </Pressable>
          </View>
          <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
            {options.map((item) => (
              <Pressable key={item.id} accessibilityRole="radio" accessibilityState={{ checked: selected === item.id }}
                style={[styles.modalOption, selected === item.id && styles.modalOptionActive]}
                onPress={() => { onSelect(item.id); onClose(); }}>
                <Text style={[styles.modalOptionText, selected === item.id && styles.modalOptionTextActive]}>{item.label}</Text>
                {selected === item.id && <Ionicons name="checkmark" size={18} color={theme.accent} />}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Pressable>
    </Modal>
  );
}
