import { useRef } from 'react';
import {
  Animated,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useWavenReducedMotion } from '../../hooks/useWavenReducedMotion';
import { wavenMotion } from '../../theme/tokens';

interface WavenPressableProps extends PressableProps {
  containerStyle?: StyleProp<ViewStyle>;
}

export function WavenPressable({
  children,
  containerStyle,
  disabled,
  onPressIn,
  onPressOut,
  ...props
}: WavenPressableProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const reducedMotion = useWavenReducedMotion();

  const animateScale = (toValue: number, duration: number) => {
    if (reducedMotion) {
      scale.setValue(1);
      return;
    }

    Animated.timing(scale, {
      toValue,
      duration,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View
      style={[
        containerStyle,
        !disabled ? { transform: [{ scale }] } : null,
      ]}
    >
      <Pressable
        {...props}
        disabled={disabled}
        onPressIn={(event) => {
          animateScale(wavenMotion.pressedScale, wavenMotion.pressInMs);
          onPressIn?.(event);
        }}
        onPressOut={(event) => {
          animateScale(1, wavenMotion.pressOutMs);
          onPressOut?.(event);
        }}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
