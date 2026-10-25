
import { MaterialIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/app/contexts/ThemeContext';

type Props = {
  title: string;
};

export default function Header({ title }: Props) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  return (
    <View style={styles.container}>
      <View style={styles.logoOuter}>
        <View style={styles.logoCircle}>
          <MaterialIcons
            name="qr-code-scanner"
            size={38}
            color={colors.textOnPrimary}
          />
        </View>
      </View>

      <Text style={styles.title}>{title}</Text>

      <Text style={styles.subtitle}>
        SMART SCHOOL ATTENDANCE
      </Text>
    </View>
  );
}

function createStyles(
  colors: ReturnType<typeof useTheme>['colors']
) {
  return StyleSheet.create({
    container: {
      alignItems: 'center',
      paddingVertical: 24,
      backgroundColor: colors.background,
    },

    logoOuter: {
      width: 94,
      height: 94,
      borderRadius: 30,
      backgroundColor: colors.glass,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 20,
    },

    logoCircle: {
      width: 72,
      height: 72,
      borderRadius: 24,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.glassBorder,
    },

    title: {
      fontSize: 27,
      fontWeight: '800',
      color: colors.textPrimary,
      letterSpacing: 0.3,
      textAlign: 'center',
    },

    subtitle: {
      marginTop: 7,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 2.5,
      color: colors.textSecondary,
    },
  });
}
