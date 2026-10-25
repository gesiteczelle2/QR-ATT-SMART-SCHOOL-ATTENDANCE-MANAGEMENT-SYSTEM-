
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useTheme } from '@/app/contexts/ThemeContext';

type Props = {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  theme?: 'primary';
  onPress: () => void;
};

export default function AppButton({
  title,
  icon,
  theme,
  onPress,
}: Props) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const isPrimary = theme === 'primary';

  return (
    <View style={styles.buttonOuter}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={title}
        style={({ pressed }) => [
          styles.buttonInner,
          isPrimary
            ? styles.primaryButton
            : styles.secondaryButton,
          pressed && styles.pressed,
        ]}
      >
        <View
          style={[
            styles.iconContainer,
            isPrimary
              ? styles.primaryIconContainer
              : styles.secondaryIconContainer,
          ]}
        >
          <Ionicons
            name={icon}
            size={21}
            color={
              isPrimary
                ? colors.textOnPrimary
                : colors.primary
            }
          />
        </View>

        <Text
          style={[
            styles.label,
            isPrimary
              ? styles.primaryLabel
              : styles.secondaryLabel,
          ]}
        >
          {title}
        </Text>

        <Ionicons
          name="chevron-forward"
          size={18}
          color={
            isPrimary
              ? 'rgba(255,255,255,0.8)'
              : colors.textSecondary
          }
        />
      </Pressable>
    </View>
  );
}

function createStyles(
  colors: ReturnType<typeof useTheme>['colors']
) {
  return StyleSheet.create({
    buttonOuter: {
      width: '100%',
      marginBottom: 14,
    },

    buttonInner: {
      minHeight: 62,
      borderRadius: 18,
      paddingVertical: 12,
      paddingHorizontal: 16,
      alignItems: 'center',
      flexDirection: 'row',
      gap: 12,
      overflow: 'hidden',
    },

    primaryButton: {
      backgroundColor: colors.primary,
      borderWidth: 1,
      borderColor: colors.glassBorder,
    },

    secondaryButton: {
      backgroundColor: colors.glass,
      borderWidth: 1,
      borderColor: colors.glassBorder,
    },

    iconContainer: {
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },

    primaryIconContainer: {
      backgroundColor: 'rgba(255,255,255,0.16)',
    },

    secondaryIconContainer: {
      backgroundColor: colors.glassLight,
    },

    label: {
      flex: 1,
      fontSize: 15,
      fontWeight: '600',
    },

    primaryLabel: {
      color: colors.textOnPrimary,
      fontWeight: '700',
    },

    secondaryLabel: {
      color: colors.textPrimary,
    },

    pressed: {
      opacity: 0.78,
      transform: [{ scale: 0.985 }],
    },
  });
}
