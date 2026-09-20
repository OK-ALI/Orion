import { Pressable, Text } from 'react-native';
import { playerStyles as styles } from './playerStyles';

export function ProviderControlsReturn({ onReturn }: { onReturn(): void }) {
  return (
    <Pressable accessibilityLabel="Back to Orion controls" onPress={onReturn} style={styles.providerControlsReturn}>
      <Text style={styles.providerControlsReturnText}>Back to Orion controls</Text>
    </Pressable>
  );
}